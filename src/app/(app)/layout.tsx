import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SessionProvider } from "next-auth/react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <SessionProvider session={session}>
      <AppShell user={session.user}>{children}</AppShell>
    </SessionProvider>
  );
}
