import { readdir } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FOCUS_ASSET_BUCKET, FOCUS_ASSET_FOLDER } from "@/lib/focus-board/asset-constants";

const PUBLIC_FOCUS_DIR = path.join(process.cwd(), "public", "focus");
const IMAGE_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);

export type FocusAssetOption = {
  fallbackValue?: string;
  label: string;
  value: string;
  source: "bundled" | "uploaded";
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

async function listBundledFocusAssets(): Promise<FocusAssetOption[]> {
  try {
    const entries = await readdir(PUBLIC_FOCUS_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({
        label: formatAssetLabel(entry.name),
        value: `/focus/${entry.name}`,
        source: "bundled" as const,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

async function listUploadedFocusAssets(): Promise<FocusAssetOption[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(FOCUS_ASSET_BUCKET).list(FOCUS_ASSET_FOLDER, {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !data) {
    return [];
  }

  return data
    .filter((item) => item.name && IMAGE_EXTENSIONS.has(path.extname(item.name).toLowerCase()))
    .map((item) => {
      const filePath = `${FOCUS_ASSET_FOLDER}/${item.name}`;
      const { data: publicUrl } = admin.storage.from(FOCUS_ASSET_BUCKET).getPublicUrl(filePath);

      return {
        fallbackValue: `/focus/${item.name}`,
        label: formatAssetLabel(item.name),
        value: publicUrl.publicUrl,
        source: "uploaded" as const,
      };
    });
}

export async function getFocusAssetOptions() {
  noStore();
  const [bundled, uploaded] = await Promise.all([
    listBundledFocusAssets(),
    listUploadedFocusAssets(),
  ]);

  const uploadedFallbacks = new Set(uploaded.map((asset) => asset.fallbackValue).filter(Boolean));
  const bundledWithoutUploadedCopy = bundled.filter((asset) => !uploadedFallbacks.has(asset.value));

  return [...uploaded, ...bundledWithoutUploadedCopy];
}
