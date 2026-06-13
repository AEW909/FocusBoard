import { randomBytes } from "node:crypto";
import {
  DEFAULT_FOCUS_BOARD_SETTINGS,
  DEFAULT_FOCUS_BOARD_TASKS,
  DEFAULT_FOCUS_REWARD_TIERS,
  DEFAULT_FOCUS_WEEKLY_REWARD,
} from "@/lib/focus-board/config";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
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
  const admin = createFocusBoardAdminClient();
  const base = normaliseSlugPart(displayName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = makeToken();
    const clientKey = `${base}-${token}`;
    const boardSlug = `${base}-${token}`;
    const boardKey = `${clientKey}-board`;
    const adminSlug = `${base}-hq-${token}`;

    const [{ data: client }, { data: board }, { data: control }] = await Promise.all([
      admin.from("clients").select("id").eq("client_key", clientKey).maybeSingle(),
      admin.from("focus_board_settings").select("board_key").eq("board_slug", boardSlug).maybeSingle(),
      admin.from("focus_board_settings").select("board_key").eq("admin_slug", adminSlug).maybeSingle(),
    ]);

    if (!client && !board && !control) {
      return {
        adminSlug,
        boardKey,
        boardSlug,
        clientKey,
      };
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

  const admin = createFocusBoardAdminClient();
  const keys = await generateProvisioningKeys(trimmedName);
  const linkedUser = ownerEmail ? await findAuthUserByEmail(ownerEmail) : null;

  if (ownerEmail && !linkedUser) {
    throw new Error(`No existing signed-in user was found for ${ownerEmail}.`);
  }

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .insert({
      client_key: keys.clientKey,
      content_lab_enabled: contentLabEnabled,
      created_by: actorUserId,
      display_name: trimmedName,
      status: "active",
      updated_by: actorUserId,
    })
    .select("id")
    .single();

  if (clientError || !clientRow) {
    throw new Error(clientError?.message ?? "Could not create the client.");
  }

  try {
    const { error: settingsError } = await admin.from("focus_board_settings").insert({
      admin_slug: keys.adminSlug,
      board_key: keys.boardKey,
      board_slug: keys.boardSlug,
      client_id: clientRow.id,
      subtitle: DEFAULT_FOCUS_BOARD_SETTINGS.subtitle,
      title: `${trimmedName}'s focus board`,
      weekly_reward_label: DEFAULT_FOCUS_WEEKLY_REWARD.label,
      weekly_reward_locked_description: DEFAULT_FOCUS_WEEKLY_REWARD.lockedDescription,
      weekly_reward_unlocked_description: DEFAULT_FOCUS_WEEKLY_REWARD.unlockedDescription,
      weekly_reward_locked_sticker_src: DEFAULT_FOCUS_WEEKLY_REWARD.lockedStickerSrc,
      weekly_reward_unlocked_sticker_src: DEFAULT_FOCUS_WEEKLY_REWARD.unlockedStickerSrc,
      weekly_reward_sticker_alt: DEFAULT_FOCUS_WEEKLY_REWARD.stickerAlt,
      weekly_target: DEFAULT_FOCUS_BOARD_SETTINGS.weeklyTarget,
    });

    if (settingsError) {
      throw new Error(`Could not create the starter board: ${settingsError.message}`);
    }

    const { data: taskRows, error: taskError } = await admin
      .from("focus_board_tasks")
      .insert(
        DEFAULT_FOCUS_BOARD_TASKS.map((task) => ({
          accent_class: task.accentClass,
          board_key: keys.boardKey,
          description: task.description,
          icon: task.icon,
          sort_order: task.sortOrder ?? 0,
          sticker_alt: task.stickerAlt,
          sticker_src: task.stickerSrc,
          task_key: task.key,
          title: task.title,
        })),
      )
      .select("id, task_key");

    if (taskError || !taskRows) {
      throw new Error(taskError?.message ?? "Could not create starter goals.");
    }

    const taskIdByKey = new Map(taskRows.map((task) => [task.task_key, task.id]));
    const metricRows = DEFAULT_FOCUS_BOARD_TASKS.flatMap((task) =>
      task.metrics.map((metric) => ({
        kind: metric.kind,
        label: metric.label,
        metric_key: metric.key,
        points: metric.points,
        sort_order: metric.sortOrder ?? 0,
        target: metric.target,
        task_id: taskIdByKey.get(task.key),
      })),
    ).filter((metric) => Boolean(metric.task_id));

    const { error: metricError } = await admin.from("focus_board_task_metrics").insert(metricRows);

    if (metricError) {
      throw new Error(`Could not create starter metrics: ${metricError.message}`);
    }

    const { error: rewardError } = await admin.from("focus_board_reward_tiers").insert(
      DEFAULT_FOCUS_REWARD_TIERS.map((reward) => ({
        board_key: keys.boardKey,
        description: reward.description,
        label: reward.label,
        locked_sticker_src: reward.lockedStickerSrc,
        min_points: reward.minPoints,
        min_weeks_hit: reward.minWeeksHit,
        sort_order: reward.sortOrder ?? 0,
        sticker_alt: reward.stickerAlt,
        unlocked_sticker_src: reward.unlockedStickerSrc,
      })),
    );

    if (rewardError) {
      throw new Error(`Could not create starter rewards: ${rewardError.message}`);
    }

    const { error: profileError } = await admin.from("client_content_profiles").upsert({
      business_name: trimmedName,
      client_id: clientRow.id,
    });

    if (profileError) {
      throw new Error(`Could not create the client content profile: ${profileError.message}`);
    }

    if (linkedUser) {
      const { error: membershipError } = await admin.from("client_memberships").insert({
        client_id: clientRow.id,
        content_lab_access: contentLabEnabled,
        created_by: actorUserId,
        is_active: true,
        role: "client_user",
        updated_by: actorUserId,
        user_id: linkedUser.id,
      });

      if (membershipError) {
        throw new Error(`Could not link the initial user: ${membershipError.message}`);
      }
    }

    return {
      boardSlug: keys.boardSlug,
      clientId: clientRow.id,
      linkedEmail: linkedUser?.email ?? null,
    };
  } catch (error) {
    const { error: settingsCleanupError } = await admin
      .from("focus_board_settings")
      .delete()
      .eq("board_key", keys.boardKey);
    const { error: clientCleanupError } = await admin.from("clients").delete().eq("id", clientRow.id);

    if (settingsCleanupError || clientCleanupError) {
      console.error("Failed to clean up partial FocusBoard provisioning:", {
        clientCleanupError,
        settingsCleanupError,
      });
    }

    throw error;
  }
}
