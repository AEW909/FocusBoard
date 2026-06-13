"use client";

import { useState } from "react";

type FocusContentLabProps = {
  clientName: string;
  slug: string;
};

const CHANNELS = [
  "Instagram",
  "Facebook",
  "Website",
  "Email",
  "Google Ads",
] as const;

const FORMATS = [
  { value: "Post caption", icon: "CAP", name: "Post caption", description: "Feed post copy" },
  { value: "Reel / video script", icon: "VID", name: "Reel / video", description: "Hook + script" },
  { value: "Story slides", icon: "STO", name: "Story slides", description: "Short swipe text" },
  { value: "Website page section", icon: "WEB", name: "Website copy", description: "Page section" },
  { value: "Email newsletter or promotional email", icon: "EML", name: "Email", description: "Newsletter / promo" },
  { value: "Ad headline and body copy", icon: "ADS", name: "Ad copy", description: "Headline + body" },
] as const;

const TONES = [
  "Warm and reassuring",
  "Educational and informative",
  "Confident and credible",
  "Soft and empathetic",
  "Direct and results-focused",
] as const;

const QUICK_TOPICS = [
  "Anti-wrinkle injections",
  "Restore Protocol",
  "RF Microneedling",
  "Polynucleotides",
  "Liona's credentials",
  "First-time clients",
  "Natural results",
  "Post-weight-loss face",
  "Why choose Skin Revive",
  "Booking a consultation",
] as const;

export function FocusContentLab({ clientName, slug }: FocusContentLabProps) {
  const [channel, setChannel] = useState<string>("Instagram");
  const [format, setFormat] = useState<string>("Post caption");
  const [tone, setTone] = useState<string>("Warm and reassuring");
  const [topic, setTopic] = useState("");
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedFormat = FORMATS.find((item) => item.value === format);

  const handleGenerate = async () => {
    if (!topic.trim() || pending) {
      return;
    }

    setPending(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch("/api/focus-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          channel,
          format,
          tone,
          topic: topic.trim(),
        }),
      });

      const data = (await response.json()) as { content?: string; error?: string };

      if (!response.ok || !data.content) {
        throw new Error(data.error || "No content returned.");
      }

      setContent(data.content);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
      );
      setContent("");
    } finally {
      setPending(false);
    }
  };

  const handleCopy = async () => {
    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <main className="focus-content-shell">
      <div className="focus-content-container">
        <header className="focus-content-header">
          <div className="focus-content-logo-mark" aria-hidden="true">
            F
          </div>
          <h1>{clientName}</h1>
          <p>Content Lab</p>
        </header>

        <section className="focus-content-card">
          <div className="focus-content-meta-row">
            <span className="focus-content-field-label">Quick launch</span>
            <span className="focus-content-secret-pill">Focus link: {slug}</span>
          </div>

          <span className="focus-content-field-label">Channel</span>
          <div className="focus-content-chip-row">
            {CHANNELS.map((item) => (
              <button
                className={`focus-content-chip ${channel === item ? "focus-content-chip-active" : ""}`}
                key={item}
                onClick={() => setChannel(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <span className="focus-content-field-label">Content format</span>
          <div className="focus-content-format-grid">
            {FORMATS.map((item) => (
              <button
                className={`focus-content-format-card ${format === item.value ? "focus-content-format-card-active" : ""}`}
                key={item.value}
                onClick={() => setFormat(item.value)}
                type="button"
              >
                <span className="focus-content-format-icon">{item.icon}</span>
                <span className="focus-content-format-name">{item.name}</span>
                <span className="focus-content-format-desc">{item.description}</span>
              </button>
            ))}
          </div>

          <span className="focus-content-field-label">Tone</span>
          <div className="focus-content-chip-row">
            {TONES.map((item) => (
              <button
                className={`focus-content-chip ${tone === item ? "focus-content-chip-active" : ""}`}
                key={item}
                onClick={() => setTone(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="focus-content-divider" />

          <span className="focus-content-field-label">What&apos;s it about?</span>
          <textarea
            className="focus-content-textarea"
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. anti-wrinkle injections for natural results, the Restore Protocol for post-weight-loss facial recovery, RF Microneedling, Liona's HCPC credentials, first-time clients..."
            value={topic}
          />

          <div className="focus-content-quick-pills">
            {QUICK_TOPICS.map((item) => (
              <button
                className="focus-content-quick-pill"
                key={item}
                onClick={() => setTopic(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <button className="focus-content-generate-button" disabled={pending} onClick={handleGenerate} type="button">
            {pending ? "Generating..." : "Generate content ->"}
          </button>
        </section>

        {error ? <p className="focus-content-error">{error}</p> : null}

        {(pending || content) && (
          <section className={`focus-content-output-card ${pending || content ? "focus-content-output-card-visible" : ""}`}>
            <div className="focus-content-output-header">
              <span className="focus-content-output-tag">
                {channel} - {selectedFormat?.name ?? "Content"}
              </span>
              <button className={`focus-content-copy-button ${copied ? "focus-content-copy-button-copied" : ""}`} disabled={!content} onClick={handleCopy} type="button">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {pending ? (
              <div className="focus-content-loading-lines" aria-hidden="true">
                <div className="focus-content-shimmer focus-content-shimmer-w80" />
                <div className="focus-content-shimmer" />
                <div className="focus-content-shimmer focus-content-shimmer-w60" />
                <div className="focus-content-shimmer focus-content-shimmer-w80" />
                <div className="focus-content-shimmer focus-content-shimmer-w50" />
              </div>
            ) : (
              <div className="focus-content-output-body">{content}</div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
