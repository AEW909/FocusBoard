import Link from "next/link";
import Image from "next/image";
import { signOutAction } from "@/app/login/actions";

type ProtectedSessionBarProps = {
  homeHref?: string;
  homeLabel?: string;
  backHref?: string;
  backLabel?: string;
  extraHref?: string;
  extraLabel?: string;
  switchHref?: string;
  switchLabel?: string;
  title: string;
};

export function ProtectedSessionBar({
  homeHref,
  homeLabel = "Open board",
  backHref,
  backLabel = "Back",
  extraHref,
  extraLabel,
  switchHref,
  switchLabel = "Switch board",
  title,
}: ProtectedSessionBarProps) {
  return (
    <div className="topbar-shell topbar-shell-focus">
      <div className="topbar topbar-focus">
        <div className="brand-lockup">
          <div className="brand-mark brand-mark-mascot" aria-hidden="true">
            <Image alt="" height={44} priority src="/focus/mascot-rainbow.svg" width={44} />
          </div>
          <div className="brand-copy">
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
          {extraHref ? (
            <Link className="button button-small topbar-focus-link" href={extraHref}>
              {extraLabel}
            </Link>
          ) : null}
          {switchHref ? (
            <Link className="button button-small topbar-focus-link" href={switchHref}>
              {switchLabel}
            </Link>
          ) : null}
          <form action={signOutAction} className="topbar-signout-form">
            <button className="button button-small topbar-focus-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
