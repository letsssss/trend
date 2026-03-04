import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Suspense } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen bg-[hsl(222,47%,7%)]">
        <Suspense fallback={<div className="w-60 shrink-0 border-r border-gray-700 bg-gray-900" />}>
          <Sidebar />
        </Suspense>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
