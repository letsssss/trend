-- 1) seed_channels 테이블 (Supabase SQL Editor에서 실행)
CREATE TABLE IF NOT EXISTS seed_channels (
  channel_id text PRIMARY KEY,
  first_added_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  note text
);

-- 2) 성장률 상위 video_id 반환 RPC (index.js에서 호출)
CREATE OR REPLACE FUNCTION trendlab_top_growing_video_ids(hours_arg int DEFAULT 24, limit_arg int DEFAULT 30)
RETURNS TABLE(video_id text)
LANGUAGE sql
STABLE
AS $$
  WITH windowed AS (
    SELECT
      s.video_id,
      s.snapshot_at,
      s.view_count,
      LAG(s.view_count) OVER (PARTITION BY s.video_id ORDER BY s.snapshot_at) AS prev_view,
      ROW_NUMBER() OVER (PARTITION BY s.video_id ORDER BY s.snapshot_at DESC) AS rn
    FROM trendlab_snapshots s
    WHERE s.snapshot_at >= now() - (hours_arg || ' hours')::interval
  ),
  deltas AS (
    SELECT w.video_id, (w.view_count - w.prev_view) AS delta
    FROM windowed w
    WHERE w.rn = 1 AND w.prev_view IS NOT NULL
  )
  SELECT d.video_id
  FROM deltas d
  ORDER BY d.delta DESC
  LIMIT limit_arg;
$$;
