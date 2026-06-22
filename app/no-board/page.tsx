import Image from "next/image";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import {
  getCurrentFocusBoardAccess,
  getFocusBoardHomePath,
} from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

export default async function NoBoardPage() {
  const current = await getCurrentFocusBoardAccess();

  if (!current) {
    redirect("/?next=%2Fno-board");
  }

  const homePath = getFocusBoardHomePath(current.access);

  if (homePath !== "/no-board") {
    redirect(homePath);
  }

  return (
    <main className="auth-shell auth-shell-focus">
      <section className="auth-card auth-card-focus no-board-card">
        <div className="auth-focus-brand">
          <div className="brand-mark brand-mark-mascot" aria-hidden="true">
            <Image alt="" height={44} priority src="/focus/mascot-rainbow.svg" width={44} />
          </div>
          <p className="auth-focus-brand-name">FocusBoard</p>
        </div>

        <p className="focus-kicker">Board assignment missing</p>
        <h1>You made it in. The board did not.</h1>
        <p className="focus-hero-copy">
          This login is real, but it has not been assigned to a FocusBoard yet. Somewhere, a tiny
          clipboard is looking busy and achieving absolutely nothing.
        </p>

        <div className="no-board-note">
          <strong>No board, no points, no suspiciously motivational stickers.</strong>
          <span>Sign out and try a different account, or ask the FocusBoard keeper to assign this one.</span>
        </div>

        <form action={signOutAction}>
          <button className="button button-primary" type="submit">
            Log out of the clipboard cupboard
          </button>
        </form>
      </section>
    </main>
  );
}
