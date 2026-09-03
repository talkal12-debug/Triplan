import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Triplan",
    short_name: "Triplan",
    description: "Trip planning, day by day, in 3 minutes.",
    id: "/he",
    start_url: "/he",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf9f5",
    theme_color: "#fbf9f5",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
