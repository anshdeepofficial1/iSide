import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GROQ_API_KEY;
    const { texts } = await req.json();
    if (!Array.isArray(texts)) return NextResponse.json({ error: "texts must be an array." }, { status: 400 });
    if (!key) return NextResponse.json({ texts });
    const model = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
    const prompt = `You are a Punjabi subtitle editor. Correct only spelling, spacing and obvious speech-recognition mistakes. Keep pure natural Punjabi in Gurmukhi. Do not translate into Hindi or English. Preserve meaning. Return ONLY a JSON array of exactly ${texts.length} strings in the same order.\n\n${JSON.stringify(texts)}`;
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.1, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ texts });
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const match = raw.match(/\[[\s\S]*\]/);
    const cleaned = match ? JSON.parse(match[0]) : texts;
    return NextResponse.json({ texts: Array.isArray(cleaned) && cleaned.length === texts.length ? cleaned : texts });
  } catch {
    return NextResponse.json({ texts: [] });
  }
}
