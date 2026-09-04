import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

webpush.setVapidDetails(
  "mailto:aewilkinson08@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Called by Vercel Cron (GET) every Sunday at 18:00 UTC.
// Vercel automatically adds Authorization: Bearer <CRON_SECRET>.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subs = await db.select().from(pushSubscriptions);

  const payload = JSON.stringify({
    title: "FocusBoard reminder",
    body: "Don't forget to log any points you've earned this week! 🎯",
    url: "/",
    tag: "weekly-reminder",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}
