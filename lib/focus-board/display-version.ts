import { unstable_noStore as noStore } from "next/cache";
import { count, eq, inArray, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  focusBoardEvents,
  focusBoardSections,
  focusBoardSettings,
  focusBoardTaskMetrics,
  focusBoardTasks,
} from "@/lib/db/schema";

function part(last: Date | null | undefined, rows: number | undefined) {
  return `${last ? last.getTime() : 0}.${rows ?? 0}`;
}

// A cheap fingerprint of everything the display renders. Row counts catch deletes
// (which leave max(timestamp) unchanged); timestamps catch edits.
export async function getDisplayVersion(boardKeys: string[]) {
  noStore();

  if (boardKeys.length === 0) {
    return "empty";
  }

  const [events, settings, sections, tasks, metrics] = await Promise.all([
    db
      .select({ last: max(focusBoardEvents.createdAt), rows: count() })
      .from(focusBoardEvents)
      .where(inArray(focusBoardEvents.boardKey, boardKeys)),
    db
      .select({ last: max(focusBoardSettings.updatedAt), rows: count() })
      .from(focusBoardSettings)
      .where(inArray(focusBoardSettings.boardKey, boardKeys)),
    db
      .select({ last: max(focusBoardSections.updatedAt), rows: count() })
      .from(focusBoardSections)
      .where(inArray(focusBoardSections.boardKey, boardKeys)),
    db
      .select({ last: max(focusBoardTasks.updatedAt), rows: count() })
      .from(focusBoardTasks)
      .where(inArray(focusBoardTasks.boardKey, boardKeys)),
    db
      .select({ last: max(focusBoardTaskMetrics.updatedAt), rows: count() })
      .from(focusBoardTaskMetrics)
      .innerJoin(focusBoardTasks, eq(focusBoardTaskMetrics.taskId, focusBoardTasks.id))
      .where(inArray(focusBoardTasks.boardKey, boardKeys)),
  ]);

  return [events, settings, sections, tasks, metrics]
    .map((rows) => part(rows[0]?.last, rows[0]?.rows))
    .join("|");
}
