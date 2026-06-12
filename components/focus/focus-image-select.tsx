"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FocusAssetOption } from "@/lib/focus-board/assets";

type FocusImageSelectProps = {
  assets: FocusAssetOption[];
  label: string;
  name?: string;
  fallbackName?: string;
  value: string;
  onChange?: (value: string) => void;
};

export function FocusImageSelect({ assets, label, name, fallbackName, value, onChange }: FocusImageSelectProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const currentValue = onChange ? value : internalValue;
  const selectedAsset = assets.find((asset) => asset.value === currentValue);
  const displayAsset =
    selectedAsset ??
    (currentValue
      ? {
          label: "Current image",
          source: "uploaded" as const,
          value: currentValue,
        }
      : null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  function selectAsset(asset: FocusAssetOption) {
    setInternalValue(asset.value);
    onChange?.(asset.value);
    setIsOpen(false);
  }

  return (
    <div
      className={`field focus-image-select-field ${isOpen ? "focus-image-select-field-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
      ref={fieldRef}
    >
      <span>{label}</span>
      {name ? <input name={name} type="hidden" value={currentValue} /> : null}
      {fallbackName ? <input name={fallbackName} type="hidden" value={selectedAsset?.fallbackValue ?? ""} /> : null}
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="focus-image-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {displayAsset ? (
          <>
            <span className="focus-image-select-trigger-art">
              <img alt="" src={displayAsset.value} />
            </span>
            <span className="focus-image-select-trigger-copy">
              <strong>{displayAsset.label}</strong>
              <small>{displayAsset.source === "uploaded" ? "Focus library" : "Built-in fallback"}</small>
            </span>
          </>
        ) : (
          <span className="focus-image-select-trigger-copy">
            <strong>Choose artwork</strong>
            <small>Open the focus image library</small>
          </span>
        )}
        <span aria-hidden="true" className="focus-image-select-chevron" />
      </button>

      {isOpen ? (
        <div aria-label={`${label} options`} className="focus-image-select-menu" id={listboxId} role="listbox">
          <div className="focus-image-select-menu-head">
            <strong>Pick your artwork</strong>
            <span>{assets.length} images</span>
          </div>
          <div className="focus-image-select-options">
            {assets.map((asset) => {
              const isSelected = asset.value === currentValue;

              return (
                <button
                  aria-selected={isSelected}
                  className={`focus-image-select-option ${isSelected ? "focus-image-select-option-selected" : ""}`}
                  key={`${asset.source}:${asset.value}`}
                  onClick={() => selectAsset(asset)}
                  role="option"
                  type="button"
                >
                  <span className="focus-image-select-option-art">
                    <img alt="" src={asset.value} />
                  </span>
                  <span className="focus-image-select-option-copy">
                    <strong>{asset.label}</strong>
                    <small>{asset.source === "uploaded" ? "Focus library" : "Built-in fallback"}</small>
                  </span>
                  <span aria-hidden="true" className="focus-image-select-option-check">
                    {isSelected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
