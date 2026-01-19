// src/stores/lendingStore.ts
// Zustand store for lending data caching (similar to roomStore)

import { create } from 'zustand';

// Flexible types for cache (API returns partial data)
export interface CachedUser {
    id: string;
    full_name: string;
    identity_number: string;
    email?: string;
    role?: string;
    phone_number?: string;
    study_program_id?: string;
}

export interface CachedEquipment {
    id: string;
    name: string;
    code: string;
    quantity?: number;
    unit?: string;
}

export interface LendingRecord {
    id: string;
    created_at: string;
    updated_at: string;
    id_user: string | null;
    date: string;
    id_equipment: string[];
    qty: number[];
    status: 'pending' | 'approved' | 'rejected' | 'borrow' | 'completed';
    attachments?: string[];
    user_info?: {
        full_name: string;
        identity_number: string;
        phone_number?: string;
        email?: string;
    };
    // These are populated lazily or from cache
    user?: CachedUser;
    equipment_details?: CachedEquipment[];
}

interface LendingState {
    // Data
    records: LendingRecord[];
    totalCount: number;

    // Cache for users and equipment (avoid re-fetching)
    usersCache: Map<string, CachedUser>;
    equipmentCache: Map<string, CachedEquipment>;

    // Cache metadata
    lastFetched: number | null;
    cacheValidMs: number;
    isStale: boolean;

    // Actions
    setRecords: (records: LendingRecord[], total: number) => void;
    updateRecord: (id: string, updates: Partial<LendingRecord>) => void;
    removeRecord: (id: string) => void;
    addToUsersCache: (users: CachedUser[]) => void;
    addToEquipmentCache: (equipment: CachedEquipment[]) => void;
    getUserFromCache: (id: string) => CachedUser | undefined;
    getEquipmentFromCache: (id: string) => CachedEquipment | undefined;

    // Cache control
    shouldRefresh: () => boolean;
    markStale: () => void;
    clearCache: () => void;
}

const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes cache

export const useLendingStore = create<LendingState>((set, get) => ({
    // Initial state
    records: [],
    totalCount: 0,
    usersCache: new Map(),
    equipmentCache: new Map(),
    lastFetched: null,
    cacheValidMs: CACHE_DURATION_MS,
    isStale: true,

    // Set records (from fetch)
    setRecords: (records, total) => set({
        records,
        totalCount: total,
        lastFetched: Date.now(),
        isStale: false
    }),

    // Update single record (for optimistic updates)
    updateRecord: (id, updates) => set(state => ({
        records: state.records.map(r =>
            r.id === id ? { ...r, ...updates } : r
        )
    })),

    // Remove record
    removeRecord: (id) => set(state => ({
        records: state.records.filter(r => r.id !== id),
        totalCount: state.totalCount - 1
    })),

    // Add users to cache
    addToUsersCache: (users) => set(state => {
        const newCache = new Map(state.usersCache);
        users.forEach(u => newCache.set(u.id, u));
        return { usersCache: newCache };
    }),

    // Add equipment to cache
    addToEquipmentCache: (equipment) => set(state => {
        const newCache = new Map(state.equipmentCache);
        equipment.forEach(eq => newCache.set(eq.id, eq));
        return { equipmentCache: newCache };
    }),

    // Get from cache
    getUserFromCache: (id) => get().usersCache.get(id),
    getEquipmentFromCache: (id) => get().equipmentCache.get(id),

    // Check if should refresh
    shouldRefresh: () => {
        const state = get();
        if (state.isStale) return true;
        if (!state.lastFetched) return true;
        return Date.now() - state.lastFetched > state.cacheValidMs;
    },

    // Mark as stale (force refresh on next fetch)
    markStale: () => set({ isStale: true }),

    // Clear all cache
    clearCache: () => set({
        records: [],
        totalCount: 0,
        usersCache: new Map(),
        equipmentCache: new Map(),
        lastFetched: null,
        isStale: true
    })
}));
