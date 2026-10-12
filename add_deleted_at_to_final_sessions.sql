-- Menambahkan kolom deleted_at untuk mendukung fitur Soft Delete pada jadwal sidang
ALTER TABLE public.final_sessions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Menambahkan kolom status untuk membedakan sidang yang Scheduled, Completed, atau Cancelled
ALTER TABLE public.final_sessions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Indexing untuk optimasi query pada halaman Session Schedule
CREATE INDEX IF NOT EXISTS idx_final_sessions_deleted_at ON public.final_sessions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_final_sessions_status ON public.final_sessions(status);
CREATE INDEX IF NOT EXISTS idx_final_sessions_date ON public.final_sessions(date);
