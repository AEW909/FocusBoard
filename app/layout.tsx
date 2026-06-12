import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "FocusBoard",
  description: "Tiny weekly wins, loud colours, and silly rewards for the business-building jobs.",
  icons: {
    icon: "/focus/sunburst-sprint-f3k9/icon",
    shortcut: "/focus/sunburst-sprint-f3k9/icon",
    apple: "/focus/sunburst-sprint-f3k9/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>{children}</body>
    </html>
  );
}
