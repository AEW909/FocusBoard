import { NextResponse } from "next/server";
import { getFocusPlatformOwnerApiAccess } from "@/lib/auth/api-access";
import { FOCUS_ASSET_BUCKET, FOCUS_ASSET_FOLDER } from "@/lib/focus-board/asset-constants";
import { normaliseFocusKey } from "@/lib/focus-board/config";
import { getFocusBoardRuntimeConfigByAdminSlug } from "@/lib/focus-board/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UploadTokenRequest = {
  adminSlug?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

const MAX_FOCUS_ASSET_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function getFileExtension(fileName: string, fileType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return fileType === "image/svg+xml" ? "svg" : "png";
}

async function ensureFocusAssetBucket() {
  const admin = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  if (!buckets?.some((bucket) => bucket.name === FOCUS_ASSET_BUCKET)) {
    const { error } = await admin.storage.createBucket(FOCUS_ASSET_BUCKET, {
      public: true,
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
      fileSizeLimit: MAX_FOCUS_ASSET_SIZE,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return admin;
}

export async function POST(request: Request) {
  try {
    const access = await getFocusPlatformOwnerApiAccess();

    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const input = (await request.json()) as UploadTokenRequest;
    const adminSlug = input.adminSlug?.trim() ?? "";
    const fileName = input.fileName?.trim() ?? "";
    const fileSize = Number(input.fileSize ?? 0);
    const fileType = input.fileType?.trim() ?? "";
    const runtime = await getFocusBoardRuntimeConfigByAdminSlug(adminSlug);

    if (!runtime) {
      return NextResponse.json({ error: "This focus control link is not valid." }, { status: 404 });
    }

    if (!fileName || fileSize <= 0) {
      return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
      return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF, or SVG image." }, { status: 400 });
    }

    if (fileSize > MAX_FOCUS_ASSET_SIZE) {
      return NextResponse.json({ error: "Focus assets must be 8 MB or smaller." }, { status: 400 });
    }

    const admin = await ensureFocusAssetBucket();
    const baseName = normaliseFocusKey(fileName.replace(/\.[^.]+$/, "")) || "focus-artwork";
    const extension = getFileExtension(fileName, fileType);
    const path = `${FOCUS_ASSET_FOLDER}/${baseName}.${extension}`;
    const { data, error } = await admin.storage
      .from(FOCUS_ASSET_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not prepare the image upload." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare the image upload." },
      { status: 500 },
    );
  }
}
