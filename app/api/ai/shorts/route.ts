import { NextRequest, NextResponse } from "next/server";

type Seg = { start: number; end: number; text: string };

function fallbackClips(segments: Seg[]) {
  const maxEnd = Math.max(0, ...segments.map(s => s.end));
  const duration = Math.max(25, Math.min(45, maxEnd / 8 || 35));
  return [0.12, 0.34, 0.58, 0.78].map((p, i) => {
    const start = Math.max(0, Math.min(maxEnd - duration, maxEnd * p));
    const end = Math.min(maxEnd, start + duration);
    const text = segments.filter(s => s.end >= start && s.start <= end).map(s => s.text).join(" ").slice(0, 280);
    return { title: `Short ${i + 1}`, start, end, reason: "Balanced highlight selected from the transcript.", socialCaption: `${text}\n\n#Punjabi #Reels #Shorts`, score: 70 - i };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { segments, videoTitle } = await req.json() as { segments: Seg[]; videoTitle?: string };
    if (!Array.isArray(segments) || !segments.length) return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    const key = process.env.GROQ_API_KEY;
    if (!key) return NextResponse.json({ clips: fallbackClips(segments), fallback: true });
    const model = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
    const compact = segments.map((s, i) => `${i}. [${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n").slice(0, 85000);
    const prompt = `Select exactly 4 distinct high-retention short-form clips from this Punjabi transcript. Each clip must be 25-55 seconds, start and end at natural sentence boundaries, avoid overlap, and prefer strong hooks, emotional insight, surprising statements, practical lessons, or self-contained stories. Do NOT claim the clips are guaranteed viral. Return ONLY valid JSON in this schema: {"clips":[{"title":"short Punjabi/English working title","start":12.3,"end":49.0,"reason":"one sentence","socialCaption":"ready-to-post Punjabi caption in Gurmukhi plus 3-6 relevant hashtags","score":0-100}]}. Times must come from transcript. Video title: ${videoTitle || "Unknown"}\n\nTRANSCRIPT:\n${compact}`;
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.25, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ clips: fallbackClips(segments), fallback: true });
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    const clips = Array.isArray(parsed.clips) ? parsed.clips.slice(0, 4) : [];
    if (clips.length !== 4) return NextResponse.json({ clips: fallbackClips(segments), fallback: true });
    return NextResponse.json({ clips });
  } catch {
    return NextResponse.json({ error: "Could not select clips." }, { status: 500 });
  }
}
