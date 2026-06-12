import Link from "next/link";
import { signOutAction } from "@/app/login/actions";

type ProtectedSessionBarProps = {
  homeHref?: string;
  homeLabel?: string;
  backHref?: string;
  backLabel?: string;
  title: string;
};

export function ProtectedSessionBar({
  homeHref,
  homeLabel = "Open board",
  backHref,
  backLabel = "Back",
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
          {backHref ? (
            <Link className="button button-small topbar-focus-link" href={backHref}>
              {backLabel}
            </Link>
          ) : null}
          {homeHref ? (
            <Link className="button button-small topbar-focus-link" href={homeHref}>
              {homeLabel}
            </Link>
          ) : null}
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
