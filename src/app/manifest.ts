import type { MetadataRoute } from "next";

// Web app manifest (Wave 3b): lets phones install lifeIsGood to the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lifeIsGood",
    short_name: "lifeIsGood",
    description: "Financial literacy for Grades 11–12, learned by doing.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
