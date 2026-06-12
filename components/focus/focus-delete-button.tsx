"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FocusDeleteButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string | undefined>;
  confirmMessage: string;
  label: string;
  disabled?: boolean;
};

export function FocusDeleteButton({
  action,
  hiddenFields,
  confirmMessage,
  label,
  disabled = false,
}: FocusDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const formData = new FormData();

      for (const [key, value] of Object.entries(hiddenFields)) {
        formData.set(key, value ?? "");
      }

      await action(formData);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        aria-label={label}
        className="focus-delete-icon"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        ×
      </button>

      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-modal="true"
            className="modal-card focus-delete-modal"
            role="dialog"
          >
            <h2>{label}</h2>
            <p>{confirmMessage}</p>
            <div className="workspace-actions">
              <button className="button button-secondary" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button className="button button-danger" disabled={pending} onClick={handleConfirmDelete} type="button">
                {pending ? "Deleting..." : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
