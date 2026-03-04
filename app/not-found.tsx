import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-foreground">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-muted-foreground">요청한 경로가 존재하지 않습니다.</p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        급상승 쇼츠로 이동
      </Link>
    </div>
  );
}
