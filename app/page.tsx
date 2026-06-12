import { redirect } from "next/navigation";
import { FOCUS_BOARD_SLUG } from "@/lib/focus-board/config";

export default function HomePage() {
  redirect(`/focus/${FOCUS_BOARD_SLUG}`);
}
