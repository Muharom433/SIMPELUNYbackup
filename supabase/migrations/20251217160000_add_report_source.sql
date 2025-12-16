-- Add source column to reports table to distinguish between user reports and technician tasks
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'user';

-- Add index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_reports_source ON public.reports(source);

-- Add comment to explain the column
COMMENT ON COLUMN public.reports.source IS 'Source of the report: user (default) or technician (manual task)';
