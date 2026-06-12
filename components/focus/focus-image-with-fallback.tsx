"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FocusImageWithFallbackProps = {
  alt: string;
  className?: string;
  expandable?: boolean;
  fallbackSrc?: string | null;
  src: string;
};

export function FocusImageWithFallback({
  alt,
  className,
  expandable = false,
  fallbackSrc,
  src,
}: FocusImageWithFallbackProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isExpanded, setIsExpanded] = useState(false);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const image = (
    <img
      alt={alt}
      className={className}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
      src={currentSrc}
    />
  );

  if (!expandable) {
    return image;
  }

  return (
    <>
      <button
        aria-label={`Enlarge ${alt}`}
        className="focus-expandable-image"
        onClick={() => setIsExpanded(true)}
        type="button"
      >
        {image}
      </button>

      {isExpanded
        ? createPortal(
            <div
              aria-labelledby={dialogTitleId}
              aria-modal="true"
              className="focus-image-viewer"
              onClick={() => setIsExpanded(false)}
              role="dialog"
            >
              <div className="focus-image-viewer-content" onClick={(event) => event.stopPropagation()}>
                <h2 className="sr-only" id={dialogTitleId}>
                  {alt}
                </h2>
                <button
                  aria-label="Close enlarged image"
                  className="focus-image-viewer-close"
                  onClick={() => setIsExpanded(false)}
                  ref={closeButtonRef}
                  type="button"
                >
                  &times;
                </button>
                <img alt={alt} className="focus-image-viewer-photo" src={currentSrc} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
