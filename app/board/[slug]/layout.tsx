import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FocusBoard",
  description: "Tiny weekly wins, loud colours, and silly rewards for the business-building jobs.",
  appleWebApp: {
    capable: true,
    title: "FocusBoard",
    statusBarStyle: "black-translucent",
  },
};

export default function BoardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
