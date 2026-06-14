export const FOCUS_BOARD_SLUG = "sunburst-sprint-f3k9";
export const FOCUS_BOARD_ADMIN_SLUG = "sunburst-sprint-hq-m8v2";
export const FOCUS_BOARD_KEY = "liona-growth-board";
export const FOCUS_WEEKLY_TARGET = 50;
export const FOCUS_THEME_PRESETS = [
  "neon",
  "sunset_pop",
  "lagoon_bounce",
  "citrus_blast",
] as const;

export type FocusThemePreset = (typeof FOCUS_THEME_PRESETS)[number];

export type FocusMetricKind = "count" | "toggle";

export type FocusBoardTaskMetric = {
  id?: string;
  key: string;
  label: string;
  target: number;
  points: number;
  kind: FocusMetricKind;
  sortOrder?: number;
  isActive?: boolean;
  isVisible?: boolean;
};

export type FocusBoardTask = {
  id?: string;
  key: string;
  icon: string;
  stickerSrc: string;
  stickerFallbackSrc?: string | null;
  stickerAlt: string;
  title: string;
  description: string;
  accentClass: string;
  sortOrder?: number;
  isActive?: boolean;
  isVisible?: boolean;
  metrics: FocusBoardTaskMetric[];
};

export type FocusRewardTier = {
  id?: string;
  label: string;
  minPoints: number;
  minWeeksHit: number;
  lockedStickerSrc: string;
  lockedStickerFallbackSrc?: string | null;
  unlockedStickerSrc: string;
  unlockedStickerFallbackSrc?: string | null;
  stickerAlt: string;
  description: string;
  sortOrder?: number;
};

export type FocusWeeklyReward = {
  label: string;
  lockedDescription: string;
  unlockedDescription: string;
  lockedStickerSrc: string;
  lockedStickerFallbackSrc?: string | null;
  unlockedStickerSrc: string;
  unlockedStickerFallbackSrc?: string | null;
  stickerAlt: string;
};

export type FocusBoardSettings = {
  clientId: string | null;
  boardKey: string;
  boardSlug: string;
  adminSlug: string;
  themePreset: FocusThemePreset;
  title: string;
  subtitle: string;
  weeklyTarget: number;
};

export const DEFAULT_FOCUS_BOARD_SETTINGS: FocusBoardSettings = {
  clientId: null,
  boardKey: FOCUS_BOARD_KEY,
  boardSlug: FOCUS_BOARD_SLUG,
  adminSlug: FOCUS_BOARD_ADMIN_SLUG,
  themePreset: "neon",
  title: "Liona's tiny-task disco",
  subtitle: "Business admin, but make it feel like stickers, sparks, and prize tokens.",
  weeklyTarget: FOCUS_WEEKLY_TARGET,
};

export const FOCUS_THEME_OPTIONS: Array<{
  value: FocusThemePreset;
  label: string;
  description: string;
}> = [
  {
    value: "neon",
    label: "Neon Arcade",
    description: "The current electric FocusBoard default.",
  },
  {
    value: "sunset_pop",
    label: "Sunset Pop",
    description: "Warm coral, melon, and disco apricot energy.",
  },
  {
    value: "lagoon_bounce",
    label: "Lagoon Bounce",
    description: "Ocean candy blues with mint and bubblegum accents.",
  },
  {
    value: "citrus_blast",
    label: "Citrus Blast",
    description: "Punchy lime, tangerine, and lemonade tones.",
  },
];

export const DEFAULT_FOCUS_WEEKLY_REWARD: FocusWeeklyReward = {
  label: "Weekly Treat",
  lockedDescription: "Keep stacking points to unlock this week's reward.",
  unlockedDescription: "A small immediate reward for hitting the weekly points target.",
  lockedStickerSrc: "/focus/liona-reward-spark-locked.png",
  unlockedStickerSrc: "/focus/liona-reward-spark.png",
  stickerAlt: "Weekly reward sticker",
};

export const DEFAULT_FOCUS_BOARD_TASKS: FocusBoardTask[] = [
  {
    key: "google_reviews",
    icon: "STAR",
    stickerSrc: "/focus/review-star.svg",
    stickerAlt: "Smiling star review sticker",
    title: "Ask for Google reviews",
    description:
      "Ask three happy patients each week for a Google review. Actual reviews earned score bonus points because they move the business fastest.",
    accentClass: "focus-task-teal",
    sortOrder: 1,
    metrics: [
      { key: "ask", label: "Asked", target: 3, points: 4, kind: "count", sortOrder: 1 },
      { key: "review", label: "Review landed", target: 0, points: 10, kind: "count", sortOrder: 2 },
    ],
  },
  {
    key: "clinic_photos",
    icon: "SNAP",
    stickerSrc: "/focus/camera-zap.svg",
    stickerAlt: "Camera sticker with neon spark",
    title: "Take usable clinic photos",
    description:
      "Capture three tidy, usable photos of the clinic, kit, or treatment moments. Only keep the ones she would actually be happy to post.",
    accentClass: "focus-task-sage",
    sortOrder: 2,
    metrics: [{ key: "photo", label: "Usable photo", target: 3, points: 8, kind: "count", sortOrder: 1 }],
  },
  {
    key: "weekly_post",
    icon: "POST",
    stickerSrc: "/focus/post-rocket.svg",
    stickerAlt: "Rocket social post sticker",
    title: "Publish the weekly post",
    description:
      "Publish one 100-word myth-vs-fact or treatment-focus post on Google, Facebook, or Instagram. Bonus if it uses one of the week's photos.",
    accentClass: "focus-task-stone",
    sortOrder: 3,
    metrics: [{ key: "post", label: "Posted", target: 1, points: 20, kind: "toggle", sortOrder: 1 }],
  },
];

export const DEFAULT_FOCUS_REWARD_TIERS: FocusRewardTier[] = [
  {
    label: "Spark Starter",
    minPoints: 40,
    minWeeksHit: 1,
    lockedStickerSrc: "/focus/liona-reward-spark-locked.png",
    unlockedStickerSrc: "/focus/liona-reward-spark.png",
    stickerAlt: "Spark reward sticker",
    description: "Tiny happy thing. Coffee, pastry, flowers, or ten guilt-free minutes spent on pure nonsense.",
    sortOrder: 1,
  },
  {
    label: "Glow Up",
    minPoints: 95,
    minWeeksHit: 2,
    lockedStickerSrc: "/focus/liona-reward-glow-locked.png",
    unlockedStickerSrc: "/focus/liona-reward-glow.png",
    stickerAlt: "Glow reward sticker",
    description: "Something she genuinely likes: lunch out, a book, a beauty treat, or a home comfort upgrade.",
    sortOrder: 2,
  },
  {
    label: "Boss Energy",
    minPoints: 150,
    minWeeksHit: 3,
    lockedStickerSrc: "/focus/liona-reward-boss-locked.png",
    unlockedStickerSrc: "/focus/liona-reward-boss.png",
    stickerAlt: "Boss reward sticker",
    description: "A bigger reward because she kept showing up for the business even when the tasks felt annoying.",
    sortOrder: 3,
  },
  {
    label: "Chaos Queen Jackpot",
    minPoints: 220,
    minWeeksHit: 4,
    lockedStickerSrc: "/focus/liona-reward-queen-locked.png",
    unlockedStickerSrc: "/focus/liona-reward-queen.png",
    stickerAlt: "Jackpot reward sticker",
    description: "Top-tier monthly reward. Dinner out, something fun, or a proper experience-level treat.",
    sortOrder: 4,
  },
];

export const FOCUS_TASK_ACCENT_CLASSES = [
  "focus-task-teal",
  "focus-task-sage",
  "focus-task-stone",
] as const;

export function normaliseFocusKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "new_item";
}

export function getAccentClassForIndex(index: number) {
  return FOCUS_TASK_ACCENT_CLASSES[index % FOCUS_TASK_ACCENT_CLASSES.length];
}
