import { readdir } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { FOCUS_ASSET_BUCKET, FOCUS_ASSET_FOLDER } from "@/lib/focus-board/asset-constants";

const PUBLIC_FOCUS_DIR = path.join(process.cwd(), "public", "focus");
const IMAGE_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);

export type FocusAssetOption = {
  label: string;
  value: string;
};

export function getBundledFocusFallback(src: string | null | undefined) {
  if (!src) {
    return null;
  }

  if (src.startsWith("/focus/")) {
    return src;
  }

  try {
    const url = new URL(src);
    const marker = `/${FOCUS_ASSET_BUCKET}/${FOCUS_ASSET_FOLDER}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const filename = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    return filename ? `/focus/${filename}` : null;
  } catch {
    return null;
  }
}

function formatAssetLabel(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{10,}-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getFocusAssetOptions(): Promise<FocusAssetOption[]> {
  noStore();
  try {
    const entries = await readdir(PUBLIC_FOCUS_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({
        label: formatAssetLabel(entry.name),
        value: `/focus/${entry.name}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}
