"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FocusImageWithFallbackProps = {
  alt: string;
  className?: string;
  expandable?: boolean;
  src: string;
};

export function FocusImageWithFallback({
  alt,
  className,
  expandable = false,
  src,
}: FocusImageWithFallbackProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
      src={src}
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
                <img alt={alt} className="focus-image-viewer-photo" src={src} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
