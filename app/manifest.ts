import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FocusBoard",
    short_name: "FocusBoard",
    description: "Tiny weekly wins, loud colours, and silly rewards for the business-building jobs.",
    start_url: "/",
    display: "standalone",
    background_color: "#04040c",
    theme_color: "#FF4DCA",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
