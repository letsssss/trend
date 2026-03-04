/**
 * TrendLab 500 - Discovery: seed_channels 기준으로 채널 최신 업로드에서 Shorts 수집 → trendlab_videos upsert
 * Search API 미사용. channels.list + playlistItems.list + videos.list 만 사용.
 *
 * 실행: node discover_uploads.js [--limit 30] [--perChannel 10] [--lookbackDays 7]
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArg(name, defaultVal) {
  const i = process.argv.indexOf(name);
  if (i === -1) return defaultVal;
  const v = process.argv[i + 1];
  return v != null ? (typeof defaultVal === "number" ? parseInt(v, 10) : v) : defaultVal;
}
const LIMIT = parseArg("--limit", 30);
const PER_CHANNEL = parseArg("--perChannel", 10);
const LOOKBACK_DAYS = parseArg("--lookbackDays", 7);

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("필요한 환경 변수: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BASE = "https://www.googleapis.com/youtube/v3";

// index.js와 동일 (복사)
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

const TITLE_BLACKLIST = ["free", "무료", "click", "광고", "지원금", "이벤트"];

function isBlacklisted(title, channelTitle) {
  const t = (title || "").toLowerCase();
  const c = (channelTitle || "").toLowerCase();
  return TITLE_BLACKLIST.some((k) => t.includes(k.toLowerCase()) || c.includes(k.toLowerCase()));
}

async function getSeedChannels(limit) {
  const { data, error } = await supabase
    .from("seed_channels")
    .select("channel_id")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.channel_id).filter(Boolean);
}

async function fetchChannelsContentDetails(channelIds) {
  if (!channelIds.length) return {};
  try {
    const res = await fetch(
      `${BASE}/channels?part=contentDetails&id=${channelIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const c of data.items || []) {
      const uploads = c.contentDetails?.relatedPlaylists?.uploads;
      if (c.id && uploads) map[c.id] = uploads;
    }
    return map;
  } catch (err) {
    console.error("[channels.list]", err?.message || err);
    return {};
  }
}

async function fetchPlaylistVideoIds(playlistId, maxResults) {
  if (!playlistId) return [];
  try {
    const res = await fetch(
      `${BASE}/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((i) => i.snippet?.resourceId?.videoId).filter(Boolean);
  } catch (err) {
    console.error("[playlistItems.list]", err?.message || err);
    return [];
  }
}

async function fetchVideosDetails(videoIds) {
  if (!videoIds.length) return [];
  try {
    const res = await fetch(
      `${BASE}/videos?part=statistics,snippet,contentDetails&id=${videoIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error("[videos.list]", err?.message || err);
    return [];
  }
}

function buildTrendlabRows(items, channelId, channelTitle, lookbackSince) {
  const now = new Date().toISOString();
  const rows = [];
  for (const v of items) {
    if (!v.id) continue;
    const durationSec = durationToSeconds(v.contentDetails?.duration);
    if (durationSec > 60) continue;
    const title = (v.snippet?.title || "").trim();
    if (!title) continue;
    if (!isKoreanEnglish(title)) continue;
    const publishedAt = v.snippet?.publishedAt;
    if (publishedAt && new Date(publishedAt) < lookbackSince) continue;
    if (isBlacklisted(title, v.snippet?.channelTitle || channelTitle)) continue;

    rows.push({
      video_id: v.id,
      channel_id: channelId || v.snippet?.channelId || null,
      channel_title: (v.snippet?.channelTitle || channelTitle || "").trim() || null,
      title,
      published_at: publishedAt || null,
      duration_sec: durationSec,
      view_count: parseInt(v.statistics?.viewCount || "0", 10),
      first_discovered_at: now,
      last_seen_at: now,
      is_active: true,
    });
  }
  return rows;
}

async function run() {
  console.log("[discover] limit=%d perChannel=%d lookbackDays=%d", LIMIT, PER_CHANNEL, LOOKBACK_DAYS);

  const channelIds = await getSeedChannels(LIMIT);
  if (!channelIds.length) {
    console.log("[discover] seed_channels에 채널 없음.");
    return;
  }
  console.log("[discover] seed_channels %d개 로드", channelIds.length);

  const uploadsMap = await fetchChannelsContentDetails(channelIds);
  const lookbackSince = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  let allVideoIds = [];
  const channelVideoCounts = [];

  for (const cid of channelIds) {
    const playlistId = uploadsMap[cid];
    if (!playlistId) continue;
    try {
      const videoIds = await fetchPlaylistVideoIds(playlistId, PER_CHANNEL);
      channelVideoCounts.push({ channel_id: cid, count: videoIds.length });
      allVideoIds.push(...videoIds);
    } catch (err) {
      console.error("[discover] channel", cid, err?.message || err);
    }
  }

  allVideoIds = [...new Set(allVideoIds)];
  console.log("[discover] 수집 videoIds 총 %d개 (중복 제거)", allVideoIds.length);
  channelVideoCounts.forEach(({ channel_id, count }) => console.log("[discover]   %s: %d개", channel_id, count));

  const allRows = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const chunk = allVideoIds.slice(i, i + 50);
    const items = await fetchVideosDetails(chunk);
    for (const v of items) {
      const cid = v.snippet?.channelId;
      const cTitle = v.snippet?.channelTitle;
      const rows = buildTrendlabRows([v], cid, cTitle, lookbackSince);
      allRows.push(...rows);
    }
  }

  if (!allRows.length) {
    console.log("[discover] Shorts 필터 후 upsert 대상 0건");
    return;
  }

  const { error } = await supabase.from("trendlab_videos").upsert(allRows, {
    onConflict: "video_id",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[discover] trendlab_videos upsert error:", error.message);
    return;
  }
  console.log("[discover] trendlab_videos %d건 upsert 완료 (first_discovered_at은 트리거로 유지)", allRows.length);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
