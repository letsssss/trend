-- 작업 1) public.trendlab_snapshots 메타 컬럼 추가 (이미 있으면 스킵)
-- Supabase SQL Editor에서 실행

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trendlab_snapshots' AND column_name = 'ingested_by'
  ) THEN
    ALTER TABLE public.trendlab_snapshots ADD COLUMN ingested_by text NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trendlab_snapshots' AND column_name = 'ingested_at'
  ) THEN
    ALTER TABLE public.trendlab_snapshots ADD COLUMN ingested_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
