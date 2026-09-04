import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FocusBoard",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4DCA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
