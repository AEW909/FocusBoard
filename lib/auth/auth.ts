import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import {
  neonAuthUser,
  neonAuthSession,
  neonAuthAccount,
  neonAuthVerification,
} from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: neonAuthUser,
      session: neonAuthSession,
      account: neonAuthAccount,
      verification: neonAuthVerification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: { enabled: true },
  plugins: [admin(), nextCookies()],
});
