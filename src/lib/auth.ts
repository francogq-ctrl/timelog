import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Check if user already exists in DB (added manually by admin)
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (dbUser) return dbUser.active;

      // Auto-create only for @andgather.co emails
      if (!user.email.endsWith("@andgather.co")) return false;

      const userCount = await prisma.user.count();
      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          role: userCount === 0 ? "ADMIN" : "MEMBER",
          active: true,
        },
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: (token.role as string) ?? "MEMBER",
        },
      };
    },
  },
});
