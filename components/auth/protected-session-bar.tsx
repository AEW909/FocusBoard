import Link from "next/link";
import { signOutAction } from "@/app/login/actions";

type ProtectedSessionBarProps = {
  homeHref: string;
  title: string;
};

export function ProtectedSessionBar({
  homeHref,
  title,
}: ProtectedSessionBarProps) {
  return (
    <div className="topbar-shell topbar-shell-focus">
      <div className="topbar topbar-focus">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-dot brand-dot-teal" />
            <span className="brand-dot brand-dot-sage" />
            <span className="brand-dot brand-dot-stone" />
          </div>
          <div>
            <p className="brand-name">FocusBoard</p>
            <p className="brand-subtitle">{title}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <Link className="button button-small topbar-focus-link" href={homeHref}>
            Open board
          </Link>
          <form action={signOutAction}>
            <button className="button button-small topbar-focus-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
