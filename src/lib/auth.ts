import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      return !!dbUser?.active;
    },
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: dbUser?.role ?? "MEMBER",
        },
      };
    },
  },
});
