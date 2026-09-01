/**
 * queryUtils.ts
 * ─────────────────────────────────────────────────────────────────
 * Utilities untuk menangani bulk data fetch secara aman:
 *   - Retry otomatis saat timeout/network error
 *   - Chunked fetch (ambil data besar secara bertahap)
 *   - Request deduplication (cegah request dobel)
 *   - Abort controller per fetch (cegah memory leak)
 * ─────────────────────────────────────────────────────────────────
 */

// ─── TYPE DEFINITIONS ────────────────────────────────────────────

export interface RetryOptions {
    maxRetries?: number;       // Max percobaan ulang (default 3)
    baseDelayMs?: number;      // Delay awal sebelum retry (default 1000ms)
    maxDelayMs?: number;       // Delay maksimal (default 8000ms)
    onRetry?: (attempt: number, error: unknown) => void;
}

export interface ChunkedFetchOptions {
    chunkSize?: number;         // Jumlah row per request (default 500)
    maxChunks?: number;         // Maksimal chunk (default 20 = 10.000 row)
    onProgress?: (loaded: number, total: number) => void;
    retryOptions?: RetryOptions;
}

// ─── EXPONENTIAL BACKOFF RETRY ───────────────────────────────────

/**
 * Jalankan fungsi async dengan retry + exponential backoff.
 * Aman digunakan karena:
 *   - Menghormati batas maxRetries (mencegah infinite loop)
 *   - Exponential backoff agar server tidak dibombardir saat down
 *   - Jitter (randomisasi delay) untuk menghindari "thundering herd"
 *     (banyak client retry bersamaan → serangan tanpa sengaja)
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        maxDelayMs = 8000,
        onRetry,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;

            const isTimeout =
                (error instanceof Error && error.name === 'AbortError') ||
                (typeof error === 'object' && error !== null && 'code' in error &&
                    (error as any).code === '57014'); // PostgreSQL statement timeout

            const isNetworkError =
                error instanceof TypeError && error.message.includes('fetch');

            // Tidak perlu retry untuk error non-recoverable
            const isNotRetryable =
                typeof error === 'object' && error !== null && 'status' in error &&
                ((error as any).status === 401 ||  // Unauthorized
                    (error as any).status === 403 ||  // Forbidden
                    (error as any).status === 404);   // Not Found

            if (attempt >= maxRetries || isNotRetryable) break;

            // Hanya retry saat timeout atau network error
            if (!isTimeout && !isNetworkError) break;

            // Exponential backoff + jitter: delay = base * 2^attempt + random(0-1000ms)
            const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
            const jitter = Math.random() * 1000; // Jitter mencegah thundering herd
            const delay = Math.floor(exponentialDelay + jitter);

            if (onRetry) onRetry(attempt + 1, error);


            await sleep(delay);
        }
    }

    throw lastError;
}

// ─── CHUNKED FETCH (BULK DATA AMAN) ──────────────────────────────

/**
 * Ambil data besar secara bertahap (chunked) dari Supabase.
 *
 * PRINSIP KERJA:
 * Daripada satu request mengambil 5000 row sekaligus (→ timeout),
 * kita bagi menjadi beberapa request kecil @chunkSize row,
 * kemudian gabungkan hasilnya.
 *
 * MENGAPA INI TIDAK SAMA DENGAN DDoS:
 * - Request dilakukan SERIAL (satu-per-satu), bukan parallel
 * - Ada delay antar request (sesuai backoff)
 * - Ada batas maxChunks untuk mencegah infinite loop
 * - AbortController memastikan request bisa di-cancel
 */
export async function chunkedFetch<T>(
    queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
    options: ChunkedFetchOptions = {}
): Promise<T[]> {
    const {
        chunkSize = 500,
        maxChunks = 20,
        onProgress,
        retryOptions = { maxRetries: 2, baseDelayMs: 500 },
    } = options;

    const allData: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < maxChunks) {
        const from = page * chunkSize;
        const to = from + chunkSize - 1;

        const { data, error } = await withRetry(
            () => queryFn(from, to),
            retryOptions
        );

        if (error) throw error;

        if (data && data.length > 0) {
            allData.push(...data);
            hasMore = data.length === chunkSize; // Ada more jika dapat data penuh
            page++;

            if (onProgress) {
                onProgress(allData.length, allData.length + (hasMore ? chunkSize : 0));
            }

            // Delay kecil antar chunk — agar server tidak langsung dibombardir
            // Ini WAJIB untuk request serial yang besar
            if (hasMore) await sleep(150);
        } else {
            hasMore = false;
        }
    }

    return allData;
}

// ─── REQUEST DEDUPLICATION ────────────────────────────────────────

/**
 * Cegah duplicate request yang sama dikirim bersamaan.
 * Contoh: user klik refresh 5x cepat → hanya 1 request yang jalan.
 *
 * Ini penting untuk mencegah "self-DDoS" dari frontend.
 */
const pendingRequests = new Map<string, Promise<unknown>>();

export async function deduplicatedFetch<T>(
    key: string,
    fn: () => Promise<T>
): Promise<T> {
    if (pendingRequests.has(key)) {
        // Kalau sudah ada request yg sama berjalan, tunggu hasilnya
        return pendingRequests.get(key) as Promise<T>;
    }

    const promise = fn().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}

// ─── ABORT CONTROLLER MANAGER ─────────────────────────────────────

/**
 * Manager untuk melacak dan membatalkan request yang sedang berjalan.
 * Gunakan ini saat filter berubah sebelum request sebelumnya selesai.
 *
 * Contoh: user ganti filter bulan sebelum data bulan sebelumnya selesai load.
 * Tanpa ini, response lama bisa datang setelah response baru → data kacau.
 */
export class AbortManager {
    private controllers: Map<string, AbortController> = new Map();

    /** Batalkan request sebelumnya dan buat yang baru */
    start(key: string): AbortController {
        this.abort(key); // Cancel yang lama
        const controller = new AbortController();
        this.controllers.set(key, controller);
        return controller;
    }

    /** Batalkan request dengan key tertentu */
    abort(key: string): void {
        const existing = this.controllers.get(key);
        if (existing) {
            existing.abort();
            this.controllers.delete(key);
        }
    }

    /** Batalkan semua request yang sedang berjalan */
    abortAll(): void {
        this.controllers.forEach(c => c.abort());
        this.controllers.clear();
    }
}

// ─── IN-MEMORY CACHE (SIMPLE TTL CACHE) ──────────────────────────

/**
 * Cache sederhana dengan TTL (Time To Live).
 * Untuk data yang tidak sering berubah (study programs, campuses, dll).
 *
 * Contoh: Daftar study_programs tidak berubah tiap detik.
 * Cache selama 5 menit agar tidak kirim request berulang.
 */
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class SimpleCache {
    private store = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
        this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

/** Singleton cache untuk dipakai di seluruh app */
export const appCache = new SimpleCache();

// ─── HELPERS ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
