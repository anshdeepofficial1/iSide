import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base=process.env.NEXT_PUBLIC_SITE_URL || "https://iside.vercel.app";
  return [{url:base,priority:1},{url:base+"/manager",priority:.9},{url:base+"/privacy",priority:.5}];
}
