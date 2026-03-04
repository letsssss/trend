-- trendlab_videos: first_discovered_at 유지 (discover_uploads.js upsert 대응)
-- Supabase SQL Editor에서 실행

-- 1) 트리거 함수: INSERT 시 NULL이면 now(), UPDATE 시 기존 값 유지
CREATE OR REPLACE FUNCTION public.trendlab_videos_set_first_discovered()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.first_discovered_at IS NULL THEN
      NEW.first_discovered_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.first_discovered_at := OLD.first_discovered_at;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) 트리거: trendlab_videos INSERT/UPDATE 전에 실행
DROP TRIGGER IF EXISTS trendlab_videos_set_first_discovered_trigger ON public.trendlab_videos;
CREATE TRIGGER trendlab_videos_set_first_discovered_trigger
  BEFORE INSERT OR UPDATE ON public.trendlab_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trendlab_videos_set_first_discovered();

-- 3) (선택) 인덱스 보강
CREATE INDEX IF NOT EXISTS idx_trendlab_videos_video_id ON public.trendlab_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_trendlab_videos_channel_id ON public.trendlab_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_trendlab_videos_last_seen_at ON public.trendlab_videos(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_seed_channels_last_seen_at ON public.seed_channels(last_seen_at DESC);
