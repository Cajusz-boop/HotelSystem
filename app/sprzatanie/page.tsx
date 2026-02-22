import type { Viewport, Metadata } from "next";
import SprzatanieClient from "./sprzatanie-client";

export const metadata: Metadata = {
  title: "Sprzątanie – Hotel Łabędź",
  description: "Oznaczanie pokoi jako posprzątane",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sprzątanie",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function SprzataniePage() {
  return <SprzatanieClient />;
}
