import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iSide Shorts Studio",
  description: "Turn each YouTube upload into four Punjabi-captioned vertical shorts and hand them off to Instagram or Facebook for final posting.",
};
export const viewport: Viewport = { themeColor: "#09090b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
