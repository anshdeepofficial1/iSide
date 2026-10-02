import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return NextResponse.json({ error: "GROQ_API_KEY is not configured in Vercel." }, { status: 503 });
    const incoming = await req.formData();
    const file = incoming.get("file");
    const offset = Number(incoming.get("offset") || 0);
    if (!(file instanceof File)) return NextResponse.json({ error: "Audio chunk is required." }, { status: 400 });

    const form = new FormData();
    form.append("file", file, file.name || "audio.mp3");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pa");
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Transcription failed." }, { status: r.status });

    const segments = Array.isArray(data.segments)
      ? data.segments.map((s: any) => ({ start: Number(s.start || 0) + offset, end: Number(s.end || 0) + offset, text: String(s.text || "").trim() })).filter((s: any) => s.text)
      : [{ start: offset, end: offset + 180, text: String(data.text || "").trim() }];
    return NextResponse.json({ segments });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Transcription failed." }, { status: 500 });
  }
}
