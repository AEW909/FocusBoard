import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function createFocusBoardAdminClient() {
  return createSupabaseAdminClient().schema("focusboard");
}
