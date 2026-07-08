"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import {
  BUSINESS_STAT_LINE_COLORS,
  getBusinessStatsConfig,
  type BusinessStatUnit,
} from "@/lib/focus-board/business-stats";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumberValue(formData: FormData, key: string) {
  const raw = getValue(formData, key);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getManagePath(clientId: string, message?: string, error?: string) {
  const params = new URLSearchParams();

  if (message) {
    params.set("businessStatsMessage", message);
  }

  if (error) {
    params.set("businessStatsError", error);
  }

  const query = params.toString();
  return query ? `/clients/${clientId}/manage?${query}` : `/clients/${clientId}/manage`;
}

function getBusinessStatsPath(
  clientId: string,
  message?: string,
  error?: string,
  returnPath?: string,
) {
  const params = new URLSearchParams();
  const basePath = returnPath?.startsWith(`/clients/${clientId}/manage`)
    ? returnPath
    : `/clients/${clientId}/manage/business-stats`;

  if (message) {
    params.set("businessStatsMessage", message);
  }

  if (error) {
    params.set("businessStatsError", error);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function revalidateBusinessStatsPaths(clientId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}/manage`);
  revalidatePath(`/clients/${clientId}/manage/business-stats`);
  revalidatePath(`/clients/${clientId}/business`);
}

function getUnit(value: string): BusinessStatUnit {
  if (value === "currency" || value === "percent") {
    return value;
  }

  return "number";
}

export async function setFocusClientBusinessStatsEnabledAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const nextEnabled = getValue(formData, "nextEnabled") === "true";
  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("clients")
    .update({ business_stats_enabled: nextEnabled, updated_by: user.id })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update Business Stats status: ${error.message}`);
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(
    getManagePath(
      clientId,
      nextEnabled ? "Business Stats enabled for this client." : "Business Stats disabled for this client.",
    ),
  );
}

export async function addBusinessStatGroupAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const { client } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(client.clientId);
  const name = getValue(formData, "name");
  const color = getValue(formData, "color") || "#00f5d4";

  if (!name) {
    redirect(getBusinessStatsPath(clientId, undefined, "Group name is required.", returnPath));
  }

  const admin = createFocusBoardAdminClient();
  const { error } = await admin.from("business_stat_groups").insert({
    client_id: clientId,
    name,
    color,
    sort_order: config.groups.filter((group) => group.isActive !== false).length + 1,
  });

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not add group: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, `Group "${name}" added.`, undefined, returnPath));
}

export async function updateBusinessStatGroupAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const groupId = getValue(formData, "groupId");
  const { client } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(client.clientId);
  const group = config.groups.find((item) => item.id === groupId);

  if (!group) {
    redirect(getBusinessStatsPath(clientId, undefined, "Group not found.", returnPath));
  }

  const admin = createFocusBoardAdminClient();
  const { error } = await admin
    .from("business_stat_groups")
    .update({
      name: getValue(formData, "name") || group.name,
      color: getValue(formData, "color") || group.color,
    })
    .eq("id", groupId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not save group: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, "Group saved.", undefined, returnPath));
}

export async function toggleBusinessStatGroupVisibilityAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const groupId = getValue(formData, "groupId");
  const shouldShow = getValue(formData, "nextVisible") === "true";
  await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(clientId);
  const visibleGroups = config.groups.filter(
    (group) => group.isActive !== false && group.isVisible !== false,
  );
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("business_stat_groups")
    .update(
      shouldShow
        ? { is_active: true, is_visible: true, sort_order: visibleGroups.length + 1 }
        : { is_visible: false },
    )
    .eq("id", groupId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not update group visibility: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, shouldShow ? "Group shown." : "Group hidden.", undefined, returnPath));
}

export async function deleteBusinessStatGroupAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const groupId = getValue(formData, "groupId");
  await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("business_stat_groups")
    .update({ is_active: false, is_visible: false })
    .eq("id", groupId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not retire group: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, "Group retired.", undefined, returnPath));
}

export async function addBusinessStatCategoryAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const { client } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(client.clientId);
  const name = getValue(formData, "name");
  const groupId = getValue(formData, "groupId") || null;

  if (!name) {
    redirect(getBusinessStatsPath(clientId, undefined, "Stat name is required.", returnPath));
  }

  if (groupId && !config.groups.some((group) => group.id === groupId && group.isActive !== false)) {
    redirect(getBusinessStatsPath(clientId, undefined, "Pick a valid stat group.", returnPath));
  }

  const admin = createFocusBoardAdminClient();
  const activeCategoryCount = config.categories.filter(
    (category) => category.isActive !== false,
  ).length;
  const color = BUSINESS_STAT_LINE_COLORS[activeCategoryCount % BUSINESS_STAT_LINE_COLORS.length];
  const { error } = await admin.from("business_stat_categories").insert({
    client_id: clientId,
    group_id: groupId,
    name,
    unit: getUnit(getValue(formData, "unit")),
    prefix: getValue(formData, "prefix"),
    suffix: getValue(formData, "suffix"),
    color,
    monthly_target: getNumberValue(formData, "monthlyTarget"),
    sort_order: activeCategoryCount + 1,
  });

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not add stat: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, `Stat "${name}" added.`, undefined, returnPath));
}

export async function updateBusinessStatCategoryAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const categoryId = getValue(formData, "categoryId");
  const { client } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(client.clientId);
  const category = config.categories.find((item) => item.id === categoryId);
  const groupId = getValue(formData, "groupId") || null;

  if (!category) {
    redirect(getBusinessStatsPath(clientId, undefined, "Stat not found.", returnPath));
  }

  if (groupId && !config.groups.some((group) => group.id === groupId && group.isActive !== false)) {
    redirect(getBusinessStatsPath(clientId, undefined, "Pick a valid stat group.", returnPath));
  }

  const admin = createFocusBoardAdminClient();
  const { error } = await admin
    .from("business_stat_categories")
    .update({
      group_id: groupId,
      name: getValue(formData, "name") || category.name,
      unit: getUnit(getValue(formData, "unit")),
      prefix: getValue(formData, "prefix"),
      suffix: getValue(formData, "suffix"),
      monthly_target: getNumberValue(formData, "monthlyTarget"),
    })
    .eq("id", categoryId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not save stat: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, "Stat saved.", undefined, returnPath));
}

export async function toggleBusinessStatCategoryVisibilityAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const categoryId = getValue(formData, "categoryId");
  const shouldShow = getValue(formData, "nextVisible") === "true";
  await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const config = await getBusinessStatsConfig(clientId);
  const visibleCategories = config.categories.filter(
    (category) => category.isActive !== false && category.isVisible !== false,
  );
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("business_stat_categories")
    .update(
      shouldShow
        ? { is_active: true, is_visible: true, sort_order: visibleCategories.length + 1 }
        : { is_visible: false },
    )
    .eq("id", categoryId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not update stat visibility: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, shouldShow ? "Stat shown." : "Stat hidden.", undefined, returnPath));
}

export async function deleteBusinessStatCategoryAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");
  const categoryId = getValue(formData, "categoryId");
  await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("business_stat_categories")
    .update({ is_active: false, is_visible: false })
    .eq("id", categoryId)
    .eq("client_id", clientId);

  if (error) {
    redirect(getBusinessStatsPath(clientId, undefined, `Could not retire stat: ${error.message}`, returnPath));
  }

  revalidateBusinessStatsPaths(clientId);
  redirect(getBusinessStatsPath(clientId, "Stat retired.", undefined, returnPath));
}
