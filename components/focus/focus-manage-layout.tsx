"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { key: "challenges", label: "Challenges", icon: "🎯" },
  { key: "board", label: "Board", icon: "📋" },
  { key: "rewards", label: "Rewards", icon: "🏆" },
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "members", label: "Members", icon: "👥" },
  { key: "images", label: "Images", icon: "🖼️" },
] as const;

function ManageNav({
  activePanel,
  pathname,
  onSelect,
}: {
  activePanel: string;
  pathname: string;
  onSelect?: () => void;
}) {
  return (
    <ul className="focus-manage-nav">
      {NAV_ITEMS.map((item) => (
        <li
          className={`focus-manage-nav-item${activePanel === item.key ? " focus-manage-nav-item-active" : ""}`}
          key={item.key}
        >
          <Link href={`${pathname}?panel=${item.key}`} onClick={onSelect}>
            <span className="focus-manage-nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

type FocusManageLayoutProps = {
  activePanel: string;
  displayName: string;
  children: React.ReactNode;
};

export function FocusManageLayout({
  activePanel,
  displayName,
  children,
}: FocusManageLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const activeLabel =
    NAV_ITEMS.find((item) => item.key === activePanel)?.label ?? "Menu";

  return (
    <div className="focus-manage-shell">
      <nav className="focus-manage-sidebar">
        <p className="focus-manage-client-label">{displayName}</p>
        <ManageNav
          activePanel={activePanel}
          pathname={pathname}
          onSelect={() => setDrawerOpen(false)}
        />
      </nav>

      {drawerOpen && (
        <div
          className="focus-manage-backdrop"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <nav className={`focus-manage-drawer${drawerOpen ? " open" : ""}`}>
        <p className="focus-manage-client-label">{displayName}</p>
        <ManageNav
          activePanel={activePanel}
          pathname={pathname}
          onSelect={() => setDrawerOpen(false)}
        />
      </nav>

      <div className="focus-manage-panel">
        <button
          className="focus-manage-drawer-toggle"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <span>☰</span>
          {activeLabel}
        </button>
        {children}
      </div>
    </div>
  );
}
