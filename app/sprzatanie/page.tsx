import type { Viewport } from "next";
import SprzatanieClient from "./sprzatanie-client";

export const metadata = {
  title: "Tryb sprzątania – Hotel PMS",
  description: "Oznaczanie pokoi jako posprzątane",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function SprzataniePage() {
  return <SprzatanieClient />;
}
