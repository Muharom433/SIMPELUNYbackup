-- Migration: Add image_url column to equipment table
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS image_url text;
