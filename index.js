/**
 * TrendLab 500 - 스냅샷 수집 스크립트 (trend 전용)
 * trendlab_videos 목록 기준으로 YouTube 조회수 수집 → trendlab_snapshots에 삽입
 * 삽입 시 ingested_by = 'desktop_trend_index_js' 로 남김 (검증용)
 *
 * 실행: node index.js [snapshot]
 *   snapshot — 1회 스냅샷만 수행 후 종료
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INGESTED_BY = "desktop_trend_index_js";

const MIN_VIEWS = 100000;
const MIN_SUBSCRIBERS = 1000;

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("필요한 환경 변수: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toHourISO(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

function isKoreanEnglish(text) {
  const korean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
  const english = /[a-zA-Z]/;
  return korean.test(text) || english.test(text);
}

function durationToSeconds(duration) {
  if (!duration || typeof duration !== "string") return Infinity;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(match?.[1] || "0", 10);
  const m = parseInt(match?.[2] || "0", 10);
  const s = parseInt(match?.[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

async function fetchVideosByIds(ids) {
  if (!ids.length) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error("[fetchVideosByIds]", err?.message || err);
    return [];
  }
}

async function fetchChannelsSubscriberCounts(channelIds) {
  const uniqIds = [...new Set(channelIds)].filter(Boolean);
  if (!uniqIds.length) return {};
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${uniqIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const c of data.items || []) {
      if (c.id && c.statistics)
        map[c.id] = parseInt(c.statistics.subscriberCount || "0", 10);
    }
    return map;
  } catch (err) {
    console.error("[fetchChannelsSubscriberCounts]", err?.message || err);
    return {};
  }
}

async function getTopGrowingVideoIds(opts = {}) {
  const hours = opts.hours ?? 24;
  const limit = opts.limit ?? 30;
  const { data, error } = await supabase.rpc("trendlab_top_growing_video_ids", {
    hours_arg: hours,
    limit_arg: limit,
  });
  if (error) {
    console.error("[getTopGrowingVideoIds]", error.message);
    return [];
  }
  return (data || []).map((row) => row.video_id).filter(Boolean);
}

async function getChannelIdsByVideoIds(videoIds) {
  if (!videoIds.length) return [];
  const { data, error } = await supabase
    .from("trendlab_videos")
    .select("video_id, channel_id")
    .in("video_id", videoIds);
  if (error) {
    console.error("[getChannelIdsByVideoIds]", error.message);
    return [];
  }
  const channelIds = [...new Set((data || []).map((r) => r.channel_id).filter((id) => id != null && String(id).trim() !== ""))];
  return channelIds;
}

async function upsertSeedChannels(channelIds) {
  if (!channelIds.length) return;
  const now = new Date().toISOString();
  const rows = channelIds.map((channel_id) => ({
    channel_id,
    last_seen_at: now,
    source: "growth_top",
  }));
  const { error } = await supabase.from("seed_channels").upsert(rows, {
    onConflict: "channel_id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
}

async function seedFromGrowthTop() {
  const topVideoIds = await getTopGrowingVideoIds({ hours: 24, limit: 30 });
  if (!topVideoIds.length) return;
  const channelIds = await getChannelIdsByVideoIds(topVideoIds);
  if (!channelIds.length) return;
  await upsertSeedChannels(channelIds);
  console.log("[seed] seed_channels", channelIds.length, "채널 upsert (source=growth_top)");
}

async function runSnapshot() {
  console.log("[snapshot] trendlab_videos 목록 조회 중...");
  const { data: videos, error: listError } = await supabase
    .from("trendlab_videos")
    .select("video_id")
    .limit(500);
  if (listError) {
    console.error("[snapshot] 목록 조회 실패:", listError.message);
    process.exit(1);
  }
  const videoIds = (videos || []).map((r) => r.video_id).filter(Boolean);
  if (!videoIds.length) {
    console.log("[snapshot] trendlab_videos에 영상이 없습니다. 먼저 discovery/등록이 필요합니다.");
    process.exit(0);
  }
  const snapshotAt = toHourISO(new Date());
  console.log("[snapshot] snapshot_at =", snapshotAt, "| 영상 수 =", videoIds.length);

  let inserted = 0;
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    let items = await fetchVideosByIds(chunk);
    if (!items.length) continue;

    const channelIds = items.map((v) => v.snippet?.channelId).filter(Boolean);
    const subsMap = await fetchChannelsSubscriberCounts(channelIds);

    const rows = [];
    for (const v of items) {
      if (!v.statistics) continue;
      const durationSec = durationToSeconds(v.contentDetails?.duration);
      if (durationSec > 60) continue;
      const title = v.snippet?.title || "";
      if (!isKoreanEnglish(title)) continue;
      const views = parseInt(v.statistics.viewCount || "0", 10);
      if (views < MIN_VIEWS) continue;
      const channelId = v.snippet?.channelId;
      const subs = channelId != null ? (subsMap[channelId] ?? 0) : 0;
      if (subs < MIN_SUBSCRIBERS) continue;
      rows.push({
        video_id: v.id,
        snapshot_at: snapshotAt,
        view_count: views,
        ingested_by: INGESTED_BY,
      });
    }
    console.log(
      `[filter] fetched=${items.length} pass=${rows.length} filtered=${items.length - rows.length}`
    );
    if (rows.length === 0) continue;
    const { error: insertError } = await supabase.from("trendlab_snapshots").upsert(rows, {
      onConflict: "video_id,snapshot_at",
      ignoreDuplicates: false,
    });
    if (insertError) {
      console.error("[snapshot] upsert error:", insertError.message);
      continue;
    }
    inserted += rows.length;
  }
  console.log("[snapshot] trendlab_snapshots", inserted, "건 upsert 완료. ingested_by =", INGESTED_BY);
  try {
    await seedFromGrowthTop();
  } catch (err) {
    console.error("[seedFromGrowthTop]", err?.message || err);
  }
}

const cmd = process.argv[2] || "snapshot";
if (cmd === "snapshot") {
  runSnapshot()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  console.log("사용법: node index.js [snapshot]");
  process.exit(1);
}
