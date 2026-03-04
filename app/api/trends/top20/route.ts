import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type TrendItem = {
  rank: number;
  video_id: string;
  title: string;
  views: number;
  view_count: number;
  views_delta_24h: number;
  growth_pct: number;
  category?: string;
  thumbnail_url?: string;
};

export async function GET() {
  try {
    const { data: rawItems, error } = await supabase.rpc("trendlab_latest_views_top20");
    if (error) {
      console.error("trendlab_latest_views_top20 error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    const items = (Array.isArray(rawItems) ? rawItems : []).map((row: Record<string, unknown>) => {
      const viewCount = Number(row.view_count ?? row.views ?? row.current_views ?? row.total_views ?? row.latest_views ?? row.views_latest ?? row.views_current ?? 0);
      return {
        ...row,
        rank: row.rank ?? row.rn ?? row.row_num,
        video_id: row.video_id ?? row.videoId ?? row.id,
        title: row.title ?? row.video_title ?? row.name,
        view_count: viewCount,
        views: viewCount,
        views_delta_24h: row.views_delta_24h ?? row.delta_24h ?? row.views_delta ?? row.delta_views ?? 0,
        growth_pct: row.growth_pct ?? row.growth_percent ?? row.growth_rate ?? 0,
        category: row.category ?? row.category_name,
      };
    });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
