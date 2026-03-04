"use client";

import { useEffect, useState } from "react";
import { ArrowUpDown, Bookmark } from "lucide-react";

type ApiItem = {
  rank?: number;
  video_id?: string;
  title?: string;
  views?: number;
  view_count?: number;
  current_views?: number;
  total_views?: number;
  latest_views?: number;
  views_delta_24h?: number;
  delta_24h?: number;
  views_delta?: number;
  growth_pct?: number;
  category?: string;
  thumbnail_url?: string;
  [key: string]: unknown;
};

type Row = {
  rank: number;
  videoId: string;
  title: string;
  views: string;
  delta24: string;
  growth: string;
  badge: "HOT" | "RISING" | "NEW";
  category: string;
  saved: boolean;
};

function formatViews(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "만";
  return String(n);
}

function pickBadge(growthPct: number): "HOT" | "RISING" | "NEW" {
  if (growthPct >= 200) return "HOT";
  if (growthPct >= 100) return "RISING";
  return "NEW";
}

function mapApiToRow(item: ApiItem, index: number): Row {
  const rank = item.rank ?? index + 1;
  const views = Number(
    item.views ??
    item.view_count ??
    item.current_views ??
    item.total_views ??
    item.latest_views ??
    item.views_latest ??
    item.views_current
  ) || 0;
  const delta24 = Number(item.views_delta_24h ?? item.delta_24h ?? item.views_delta ?? item.delta_views) || 0;
  const growthPct = Number(item.growth_pct ?? item.growth_percent ?? item.growth_rate) || 0;
  const videoId = String(item.video_id ?? item.videoId ?? "");
  const title = String(item.title ?? item.video_title ?? "-");
  const category = String(item.category ?? item.category_name ?? "-");
  return {
    rank,
    videoId,
    title,
    views: formatViews(views),
    delta24: delta24 >= 0 ? `+${formatViews(delta24)}` : formatViews(delta24),
    growth: `${growthPct >= 0 ? "+" : ""}${Math.round(growthPct)}`,
    badge: pickBadge(growthPct),
    category,
    saved: false,
  };
}

function SortButton({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
      <ArrowUpDown className="size-3" aria-hidden />
    </button>
  );
}

function Badge({ type }: { type: "HOT" | "RISING" | "NEW" }) {
  const styles = {
    HOT: "bg-hot/15 text-hot",
    RISING: "bg-warning/15 text-warning",
    NEW: "bg-chart-1/15 text-chart-1",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-md w-fit whitespace-nowrap shrink-0 gap-1 text-[10px] font-semibold px-1.5 py-0 border-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent ${styles[type]}`}>
      {type}
    </span>
  );
}

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trends/top20")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (!body.success) {
          setError(body.error ?? "데이터를 불러오지 못했습니다.");
          setRows([]);
          return;
        }
        const items: ApiItem[] = Array.isArray(body.items) ? body.items : [];
        setRows(items.map((item, i) => mapApiToRow(item, i)));
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? "네트워크 오류");
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">급상승 쇼츠</h1>
        <p className="text-sm text-muted-foreground">속도 점수 순으로 정렬됨. 행을 클릭하면 상세 패널이 열립니다.</p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            불러오는 중…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <p>{error}</p>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => window.location.reload()}
            >
              새로고침
            </button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            데이터가 없습니다.
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="relative w-full overflow-x-auto" data-slot="table-container">
            <table className="w-full caption-bottom text-sm" data-slot="table">
              <thead className="[&_tr]:border-b" data-slot="table-header">
                <tr className="data-[state=selected]:bg-muted border-b transition-colors border-border hover:bg-transparent" data-slot="table-row">
                  <th className="h-10 px-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] w-12 text-xs font-medium text-muted-foreground text-center" data-slot="table-head">랭크</th>
                  <th className="h-10 px-2 text-left align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs font-medium text-muted-foreground" data-slot="table-head">제목</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-head">
                    <SortButton>조회수</SortButton>
                  </th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-head">
                    <SortButton active>+24시간</SortButton>
                  </th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-head">
                    <SortButton>성장률 %</SortButton>
                  </th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-head">
                    <SortButton>성장 속도</SortButton>
                  </th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-head">
                    <SortButton>카테고리</SortButton>
                  </th>
                  <th className="h-10 px-2 text-left align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs font-medium text-muted-foreground w-10" data-slot="table-head">저장</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0" data-slot="table-body">
                {rows.map((row) => (
                  <tr
                    key={row.videoId || row.rank}
                    className="data-[state=selected]:bg-muted border-b cursor-pointer border-border transition-colors hover:bg-accent/50"
                    data-slot="table-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => {}}
                    onKeyDown={(e) => e.key === "Enter" && (() => {})()}
                  >
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center" data-slot="table-cell">
                      <span className={`text-xs font-bold tabular-nums ${row.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>{row.rank}</span>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] py-2" data-slot="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                          <img
                            src={row.videoId ? `https://img.youtube.com/vi/${row.videoId}/mqdefault.jpg` : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect fill='%23333' width='320' height='180'/%3E%3C/svg%3E"}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="text-sm font-medium text-card-foreground line-clamp-1 max-w-[240px]">{row.title}</span>
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs font-medium text-card-foreground" data-slot="table-cell">{row.views}</td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs font-medium text-success" data-slot="table-cell">{row.delta24}</td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs font-semibold text-success" data-slot="table-cell">{row.growth}%</td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-cell">
                      <Badge type={row.badge} />
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-xs text-muted-foreground" data-slot="table-cell">{row.category}</td>
                    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]" data-slot="table-cell">
                      <button type="button" className="focus:outline-none" aria-label={row.saved ? "저장됨" : "저장하기"}>
                        <Bookmark
                          className={`size-4 transition-colors ${row.saved ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          aria-hidden
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
