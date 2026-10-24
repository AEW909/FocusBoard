import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, displayTokens, focusBoardSettings } from "@/lib/db/schema";

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60_000;

export type DisplayClient = {
  clientKey: string;
  displayName: string;
  boardKey: string;
};

export function normaliseDisplayGroup(input: string | null | undefined) {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDisplayToken(input: { group: string; label: string; userId: string }) {
  const token = randomBytes(32).toString("base64url");

  const [row] = await db
    .insert(displayTokens)
    .values({
      displayGroup: input.group,
      tokenHash: hashToken(token),
      label: input.label,
      createdBy: input.userId,
    })
    .returning({ id: displayTokens.id });

  return { id: row!.id, token };
}

export async function revokeDisplayToken(id: string) {
  await db
    .update(displayTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(displayTokens.id, id), isNull(displayTokens.revokedAt)));
}

export async function listDisplayTokens() {
  return db
    .select({
      id: displayTokens.id,
      displayGroup: displayTokens.displayGroup,
      label: displayTokens.label,
      createdAt: displayTokens.createdAt,
      lastUsedAt: displayTokens.lastUsedAt,
      revokedAt: displayTokens.revokedAt,
    })
    .from(displayTokens)
    .orderBy(asc(displayTokens.displayGroup), desc(displayTokens.createdAt));
}

// Returns the token's group when it is valid and not revoked; null otherwise.
export async function resolveDisplayToken(token: string | null | undefined) {
  if (!token || token.length > 200) {
    return null;
  }

  const [row] = await db
    .select({
      id: displayTokens.id,
      displayGroup: displayTokens.displayGroup,
      lastUsedAt: displayTokens.lastUsedAt,
    })
    .from(displayTokens)
    .where(and(eq(displayTokens.tokenHash, hashToken(token)), isNull(displayTokens.revokedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    await db.update(displayTokens).set({ lastUsedAt: new Date() }).where(eq(displayTokens.id, row.id));
  }

  return { id: row.id, group: row.displayGroup };
}

export async function getBoardDisplayGroups() {
  return db
    .select({
      boardKey: focusBoardSettings.boardKey,
      displayName: clients.displayName,
      status: clients.status,
      displayGroup: focusBoardSettings.displayGroup,
    })
    .from(focusBoardSettings)
    .innerJoin(clients, eq(focusBoardSettings.clientId, clients.id))
    .orderBy(asc(clients.displayName));
}

export async function getDisplayGroupClients(group: string): Promise<DisplayClient[]> {
  if (!group) {
    return [];
  }

  return db
    .select({
      clientKey: clients.clientKey,
      displayName: clients.displayName,
      boardKey: focusBoardSettings.boardKey,
    })
    .from(focusBoardSettings)
    .innerJoin(clients, eq(focusBoardSettings.clientId, clients.id))
    .where(and(eq(focusBoardSettings.displayGroup, group), eq(clients.status, "active")))
    .orderBy(asc(clients.displayName));
}
