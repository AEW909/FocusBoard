"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FOCUS_ASSET_BUCKET } from "@/lib/focus-board/asset-constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FocusAssetUploadFormProps = {
  adminSlug: string;
};

type UploadTokenResponse = {
  error?: string;
  path?: string;
  token?: string;
};

export function FocusAssetUploadForm({ adminSlug }: FocusAssetUploadFormProps) {
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];

    setError("");
    setSuccess("");

    if (!file) {
      setError("Choose an image to upload.");
      return;
    }

    setIsUploading(true);

    try {
      const tokenResponse = await fetch("/api/focus-assets/upload-token", {
        body: JSON.stringify({
          adminSlug,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const prepared = (await tokenResponse.json()) as UploadTokenResponse;

      if (!tokenResponse.ok || prepared.error || !prepared.path || !prepared.token) {
        setError(prepared.error ?? "Could not prepare the image upload.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(FOCUS_ASSET_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          cacheControl: "0",
          contentType: file.type,
        });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setSuccess(`${file.name} uploaded.`);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The image could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="focus-control-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Upload image</span>
        <input
          accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
          name="asset"
          ref={inputRef}
          type="file"
          required
        />
      </label>
      <p className="focus-upload-note">
        Up to 8 MB. The original filename is kept tidy; uploading the same filename replaces the existing image.
      </p>
      <button className="button button-primary" disabled={isUploading} type="submit">
        {isUploading ? "Uploading image..." : "Upload image"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="focus-control-saved-tag">{success}</p> : null}
    </form>
  );
}
