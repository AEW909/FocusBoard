import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  clientContentProfiles,
  clientMemberships,
  focusBoardSettings,
  focusBoardSections,
  focusBoardTasks,
  focusBoardTaskMetrics,
  focusBoardRewardTiers,
} from "@/lib/db/schema";
import {
  DEFAULT_FOCUS_BOARD_SETTINGS,
  DEFAULT_FOCUS_BOARD_SECTION,
  DEFAULT_FOCUS_BOARD_TASKS,
  DEFAULT_FOCUS_REWARD_TIERS,
  DEFAULT_FOCUS_WEEKLY_REWARD,
} from "@/lib/focus-board/config";
import { findAuthUserByEmail } from "@/lib/focus-board/memberships";

function normaliseSlugPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "focus-board";
}

function makeToken() {
  return randomBytes(2).toString("hex");
}

async function generateProvisioningKeys(displayName: string) {
  const base = normaliseSlugPart(displayName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = makeToken();
    const clientKey = `${base}-${token}`;
    const boardSlug = `${base}-${token}`;
    const boardKey = `${clientKey}-board`;
    const adminSlug = `${base}-hq-${token}`;

    const [clientRows, boardRows, controlRows] = await Promise.all([
      db.select({ id: clients.id }).from(clients).where(eq(clients.clientKey, clientKey)).limit(1),
      db.select({ boardKey: focusBoardSettings.boardKey }).from(focusBoardSettings).where(eq(focusBoardSettings.boardSlug, boardSlug)).limit(1),
      db.select({ boardKey: focusBoardSettings.boardKey }).from(focusBoardSettings).where(eq(focusBoardSettings.adminSlug, adminSlug)).limit(1),
    ]);

    if (!clientRows[0] && !boardRows[0] && !controlRows[0]) {
      return { adminSlug, boardKey, boardSlug, clientKey };
    }
  }

  throw new Error("Could not generate a unique client slug. Please try again.");
}

type ProvisionFocusClientInput = {
  actorUserId: string;
  contentLabEnabled: boolean;
  displayName: string;
  ownerEmail?: string;
};

export async function provisionFocusClient({
  actorUserId,
  contentLabEnabled,
  displayName,
  ownerEmail,
}: ProvisionFocusClientInput) {
  const trimmedName = displayName.trim();

  if (!trimmedName) {
    throw new Error("Client name is required.");
  }

  const keys = await generateProvisioningKeys(trimmedName);
  const linkedUser = ownerEmail ? await findAuthUserByEmail(ownerEmail) : null;

  if (ownerEmail && !linkedUser) {
    throw new Error(`No existing signed-in user was found for ${ownerEmail}.`);
  }

  const [clientRow] = await db
    .insert(clients)
    .values({
      clientKey: keys.clientKey,
      contentLabEnabled,
      createdBy: actorUserId,
      displayName: trimmedName,
      status: "active",
      updatedBy: actorUserId,
    })
    .returning({ id: clients.id });

  if (!clientRow) {
    throw new Error("Could not create the client.");
  }

  try {
    await db.insert(focusBoardSettings).values({
      adminSlug: keys.adminSlug,
      boardKey: keys.boardKey,
      boardSlug: keys.boardSlug,
      clientId: clientRow.id,
      subtitle: DEFAULT_FOCUS_BOARD_SETTINGS.subtitle,
      title: `${trimmedName}'s focus board`,
      weeklyRewardLabel: DEFAULT_FOCUS_WEEKLY_REWARD.label,
      weeklyRewardLockedDescription: DEFAULT_FOCUS_WEEKLY_REWARD.lockedDescription,
      weeklyRewardUnlockedDescription: DEFAULT_FOCUS_WEEKLY_REWARD.unlockedDescription,
      weeklyRewardLockedStickerSrc: DEFAULT_FOCUS_WEEKLY_REWARD.lockedStickerSrc,
      weeklyRewardUnlockedStickerSrc: DEFAULT_FOCUS_WEEKLY_REWARD.unlockedStickerSrc,
      weeklyRewardStickerAlt: DEFAULT_FOCUS_WEEKLY_REWARD.stickerAlt,
      weeklyTarget: DEFAULT_FOCUS_BOARD_SETTINGS.weeklyTarget,
    });

    const [sectionRow] = await db
      .insert(focusBoardSections)
      .values({
        boardKey: keys.boardKey,
        description: DEFAULT_FOCUS_BOARD_SECTION.description,
        isActive: true,
        isVisible: true,
        sectionKey: DEFAULT_FOCUS_BOARD_SECTION.key,
        sortOrder: DEFAULT_FOCUS_BOARD_SECTION.sortOrder ?? 1,
        title: DEFAULT_FOCUS_BOARD_SECTION.title,
      })
      .returning({ id: focusBoardSections.id });

    if (!sectionRow) {
      throw new Error("Could not create starter board section.");
    }

    const taskRows = await db
      .insert(focusBoardTasks)
      .values(
        DEFAULT_FOCUS_BOARD_TASKS.map((task) => ({
          accentClass: task.accentClass,
          boardKey: keys.boardKey,
          description: task.description,
          icon: task.icon,
          sectionId: sectionRow.id,
          sortOrder: task.sortOrder ?? 0,
          stickerAlt: task.stickerAlt,
          stickerSrc: task.stickerSrc,
          taskKey: task.key,
          title: task.title,
        })),
      )
      .returning({ id: focusBoardTasks.id, taskKey: focusBoardTasks.taskKey });

    if (!taskRows.length) {
      throw new Error("Could not create starter goals.");
    }

    const taskIdByKey = new Map(taskRows.map((task) => [task.taskKey, task.id]));
    const metricValues = DEFAULT_FOCUS_BOARD_TASKS.flatMap((task) =>
      task.metrics.map((metric) => ({
        kind: metric.kind,
        label: metric.label,
        metricKey: metric.key,
        points: metric.points,
        sortOrder: metric.sortOrder ?? 0,
        target: metric.target,
        taskId: taskIdByKey.get(task.key)!,
      })),
    ).filter((metric) => Boolean(metric.taskId));

    await db.insert(focusBoardTaskMetrics).values(metricValues);

    await db.insert(focusBoardRewardTiers).values(
      DEFAULT_FOCUS_REWARD_TIERS.map((reward) => ({
        boardKey: keys.boardKey,
        description: reward.description,
        label: reward.label,
        lockedStickerSrc: reward.lockedStickerSrc,
        minPoints: reward.minPoints,
        minWeeksHit: reward.minWeeksHit,
        sortOrder: reward.sortOrder ?? 0,
        stickerAlt: reward.stickerAlt,
        unlockedStickerSrc: reward.unlockedStickerSrc,
      })),
    );

    await db
      .insert(clientContentProfiles)
      .values({ businessName: trimmedName, clientId: clientRow.id })
      .onConflictDoUpdate({
        target: clientContentProfiles.clientId,
        set: { businessName: trimmedName },
      });

    if (linkedUser) {
      await db.insert(clientMemberships).values({
        clientId: clientRow.id,
        contentLabAccess: contentLabEnabled,
        createdBy: actorUserId,
        isActive: true,
        role: "client_user",
        updatedBy: actorUserId,
        userId: linkedUser.id,
      });
    }

    return {
      boardSlug: keys.boardSlug,
      clientId: clientRow.id,
      linkedEmail: linkedUser?.email ?? null,
    };
  } catch (error) {
    try {
      await db.delete(focusBoardSettings).where(eq(focusBoardSettings.boardKey, keys.boardKey));
    } catch (settingsCleanupError) {
      console.error("Failed to clean up partial FocusBoard settings:", settingsCleanupError);
    }

    try {
      await db.delete(clients).where(eq(clients.id, clientRow.id));
    } catch (clientCleanupError) {
      console.error("Failed to clean up partial FocusBoard client:", clientCleanupError);
    }

    throw error;
  }
}
