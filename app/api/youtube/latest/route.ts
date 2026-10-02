import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function decodeXml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function resolveChannelId(input: string) {
  const direct = input.match(/(?:youtube\.com\/channel\/|^)(UC[\w-]{20,})/i)?.[1];
  if (direct) return direct;

  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = url.startsWith("@") ? `https://www.youtube.com/${url}` : `https://www.youtube.com/@${url}`;
  }
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error("Could not open that YouTube channel.");
  const html = await res.text();
  const id = html.match(/"channelId":"(UC[\w-]+)"/)?.[1]
    || html.match(/<meta itemprop="channelId" content="(UC[\w-]+)"/)?.[1]
    || html.match(/"externalId":"(UC[\w-]+)"/)?.[1];
  if (!id) throw new Error("Could not resolve the YouTube channel ID.");
  return id;
}

export async function GET(req: NextRequest) {
  try {
    const channel = req.nextUrl.searchParams.get("channel")?.trim();
    if (!channel) return NextResponse.json({ error: "Channel link is required." }, { status: 400 });
    const channelId = await resolveChannelId(channel);
    const rss = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { cache: "no-store" });
    if (!rss.ok) throw new Error("Could not fetch the channel feed.");
    const xml = await rss.text();
    const channelTitle = decodeXml(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "YouTube Channel");
    const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
    if (!entry) throw new Error("No public uploads were found.");
    const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Latest upload");
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";
    return NextResponse.json({
      channelId,
      channelTitle,
      videoId,
      title,
      published,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "YouTube lookup failed." }, { status: 500 });
  }
}
