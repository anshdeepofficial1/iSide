import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://iside.vercel.app"),
  title: { default: "iSide — IPA Installer & Manager", template: "%s · iSide" },
  description: "A clean IPA installation workflow with local app analysis, update tracking, and signing-expiry management.",
  applicationName: "iSide Manager",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: { title: "iSide", description: "Install, track and manage iOS apps from one clean place.", type: "website", images: ["/icon.svg"] },
  robots: { index: true, follow: true }
};
export const viewport: Viewport = { themeColor: "#07111f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{__html:`
    if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
  `}} /></body></html>;
}
