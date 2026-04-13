"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, BarChart3, Settings, ShieldCheck, LogOut, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
}

const navItems = [
  { href: "/log", label: "Log", icon: Clock },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["MANAGER", "ADMIN"] },
  { href: "/audit", label: "Audit", icon: ShieldCheck, roles: ["ADMIN"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["ADMIN"] },
];

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0b]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-5">
            <Link href="/log" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-400/10">
                <Clock className="h-3.5 w-3.5 text-lime-400" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                TimeLog
              </span>
            </Link>
            <nav className="flex items-center gap-0.5">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-gpu",
                      isActive
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User menu */}
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-zinc-500 transition-gpu hover:bg-white/[0.04] hover:text-zinc-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-zinc-300">
                {initials}
              </div>
              <span className="hidden sm:inline">{user.name?.split(" ")[0]}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
            <div className="invisible absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/[0.08] bg-[#141416] p-1 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:opacity-100">
              <div className="px-3 py-2 text-[11px] text-zinc-500">
                {user.email}
              </div>
              <div className="h-px bg-white/[0.06]" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-red-400 transition-gpu hover:bg-red-400/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
