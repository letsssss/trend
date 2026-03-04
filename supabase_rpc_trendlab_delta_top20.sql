-- trendlab_delta_top20: 성장률 상위 20 + 최신 조회수(view_count) 포함 → 웹 조회수 칸에 붙음
-- Supabase SQL Editor에서 실행

CREATE OR REPLACE FUNCTION trendlab_delta_top20()
RETURNS TABLE (
  rank bigint,
  video_id text,
  title text,
  view_count bigint,
  views_delta_24h bigint,
  growth_pct numeric,
  category text
)
LANGUAGE sql
STABLE
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (video_id)
      video_id,
      view_count,
      snapshot_at
    FROM trendlab_snapshots
    ORDER BY video_id, snapshot_at DESC
  ),
  prev AS (
    SELECT
      s.video_id,
      s.view_count AS prev_view,
      s.snapshot_at
    FROM trendlab_snapshots s
    WHERE s.snapshot_at >= now() - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM trendlab_snapshots s2
      WHERE s2.video_id = s.video_id AND s2.snapshot_at > s.snapshot_at
    )
  ),
  deltas AS (
    SELECT
      l.video_id,
      l.view_count,
      (l.view_count - p.prev_view) AS delta_24h,
      CASE WHEN p.prev_view > 0
        THEN round(100.0 * (l.view_count - p.prev_view) / p.prev_view, 2)
        ELSE 0
      END AS growth_pct
    FROM latest l
    LEFT JOIN prev p ON p.video_id = l.video_id
  )
  SELECT
    row_number() OVER (ORDER BY d.growth_pct DESC NULLS LAST)::bigint AS rank,
    d.video_id,
    v.title,
    d.view_count,
    coalesce(d.delta_24h, 0)::bigint AS views_delta_24h,
    coalesce(d.growth_pct, 0) AS growth_pct,
    v.channel_title AS category
  FROM deltas d
  JOIN trendlab_videos v ON v.video_id = d.video_id
  ORDER BY d.growth_pct DESC NULLS LAST
  LIMIT 20;
$$;
