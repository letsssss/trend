# trendlab_snapshots ingested_by 검증

## 작업 1) 스키마 변경 (Supabase SQL Editor에서 1회 실행)

`supabase_add_ingested_meta.sql` 내용을 복사해 Supabase Dashboard → SQL Editor에서 실행하세요.

## 작업 3) 검증 쿼리 (Supabase SQL Editor)

최신 20건에서 `ingested_by` / `ingested_at` 확인:

```sql
SELECT snapshot_at, ingested_by, ingested_at
FROM public.trendlab_snapshots
ORDER BY ingested_at DESC
LIMIT 20;
```

## 작업 4) 실행 방법 (PowerShell)

1. trend 폴더로 이동 후 dotenv 설치(최초 1회):

```powershell
cd C:\Users\jinseong\Desktop\trend
npm install dotenv
```

2. 스냅샷 1회 실행:

```powershell
cd C:\Users\jinseong\Desktop\trend
node index.js snapshot
```

또는 npm 스크립트:

```powershell
cd C:\Users\jinseong\Desktop\trend
npm run snapshot
```

3. Supabase SQL Editor에서 위 검증 쿼리 실행 → `ingested_by = 'desktop_trend_index_js'`, `ingested_at` 이 찍혀 있으면 Desktop\trend\index.js 가 삽입한 데이터입니다.
