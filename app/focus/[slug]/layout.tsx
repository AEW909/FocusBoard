import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liona Reward Board",
  description: "Tiny weekly wins, loud colours, and silly rewards for the business-building jobs.",
  appleWebApp: {
    capable: true,
    title: "Reward Board",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/focus/sunburst-sprint-f3k9/icon",
    apple: "/focus/sunburst-sprint-f3k9/apple-icon",
  },
};

export default function FocusLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
