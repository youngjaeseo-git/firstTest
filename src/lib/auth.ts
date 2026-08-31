import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        if (!user.approved) {
          throw new Error("PENDING_APPROVAL");
        }

        const orgs = await prisma.userOrganization.findMany({
          where: { userId: user.id },
          select: { organizationId: true },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgIds: orgs.map(o => o.organizationId),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.id = user.id;
        token.orgIds = (user as unknown as { orgIds: string[] }).orgIds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string; id: string }).role =
          token.role as string;
        (session.user as { id: string }).id = token.id as string;
        (session.user as { orgIds: string[] }).orgIds =
          (token.orgIds as string[]) ?? [];
      }
      return session;
    },
  },
};
