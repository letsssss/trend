"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  TrendingUp,
  Hash,
  Users,
  Bookmark,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "급상승 쇼츠", icon: TrendingUp },
  { href: "/keywords", label: "키워드", icon: Hash },
  { href: "/channels", label: "채널", icon: Users },
  { href: "/saved", label: "저장함", icon: Bookmark },
  { href: "/settings", label: "설정", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Flame className="size-4 text-primary-foreground" aria-hidden />
        </div>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          ShortsPulse
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
            JK
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-sidebar-foreground">
              김진
            </span>
            <span className="text-[10px] text-muted-foreground">프로 플랜</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
