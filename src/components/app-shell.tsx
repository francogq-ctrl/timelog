"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, BarChart3, Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { href: "/reports", label: "Reportes", icon: BarChart3, roles: ["MANAGER", "ADMIN"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["ADMIN"] },
];

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/log" className="text-lg font-bold text-white">
              TimeLog
            </Link>
            <nav className="flex items-center gap-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800/50">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="bg-zinc-800 text-xs">
                  {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{user.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
