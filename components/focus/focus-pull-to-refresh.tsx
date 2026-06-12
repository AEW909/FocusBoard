"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const REFRESH_THRESHOLD = 86;

type FocusPullToRefreshProps = {
  label?: string;
};

export function FocusPullToRefresh({ label = "Release to refresh" }: FocusPullToRefreshProps) {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || event.touches.length !== 1) {
        startY.current = null;
        return;
      }

      startY.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startY.current === null || window.scrollY > 0) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) {
        return;
      }

      const pullDistance = Math.max(0, currentY - startY.current);
      setDistance(Math.min(pullDistance, REFRESH_THRESHOLD + 34));
    };

    const handleTouchEnd = () => {
      if (distance >= REFRESH_THRESHOLD) {
        startTransition(() => {
          router.refresh();
        });
      }

      startY.current = null;
      setDistance(0);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [distance, router]);

  const visible = distance > 8 || isPending;
  const progress = Math.min(1, distance / REFRESH_THRESHOLD);

  return (
    <div
      aria-live="polite"
      className={`focus-pull-refresh ${visible ? "focus-pull-refresh-visible" : ""}`}
      style={{ transform: `translate(-50%, ${visible ? Math.round(progress * 18) : -18}px)` }}
    >
      <span className={isPending ? "focus-pull-refresh-spinner" : ""} />
      {isPending ? "Refreshing..." : distance >= REFRESH_THRESHOLD ? label : "Pull to refresh"}
    </div>
  );
}
