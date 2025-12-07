import { compare } from "bcrypt-ts";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { guestRegex } from "@/lib/constants";
import { db } from "@/lib/db";
import { generateHashedPassword } from "@/lib/db/utils";

export type UserType = "guest" | "regular";

const baseOptions = {
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: async (password) => {
        return await Promise.resolve(generateHashedPassword(password));
      },
      verify: async ({ hash, password }) => {
        try {
          return await compare(password, hash);
        } catch {
          return false;
        }
      },
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
} satisfies BetterAuthOptions;

const authOptions = {
  ...baseOptions,
  plugins: [
    customSession(async ({ user, session }) => {
      // Determine user type from email pattern (guest users have guest-* emails)
      const userType: UserType = guestRegex.test(user.email ?? "")
        ? "guest"
        : "regular";

      // to circumvent the issue with the requiring await plugin
      return await Promise.resolve({
        user: {
          ...user,
          type: userType,
        },
        session,
      });
    }, baseOptions),
    tanstackStartCookies(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
