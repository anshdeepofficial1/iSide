"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  FileVideo,
  Instagram,
  LoaderCircle,
  Play,
  RefreshCcw,
  Scissors,
  Sparkles,
  Upload,
  Youtube,
} from "lucide-react";
import type { LatestVideo, ShortClip, TranscriptSegment } from "@/lib/types";

type FFmpegLike = {
  load: (o: any) => Promise<boolean>;
  writeFile: (name: string, data: any) => Promise<void>;
  readFile: (name: string) => Promise<any>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, cb: (payload: any) => void) => void;
};

type Rendered = Record<string, { url: string; fileName: string }>;

const DEFAULT_CHANNEL = "https://youtube.com/@rojanabhaktii";
const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansgurmukhi/NotoSansGurmukhi%5Bwdth,wght%5D.ttf";

function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(d) ? resolve(d) : reject(new Error("Could not read video duration."));
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not open this video.")); };
    video.src = url;
  });
}

function wrapPunjabi(text: string, max = 30) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
    if (lines.length === 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  return lines.join("\n");
}

function clampClip(c: any, max: number, i: number): ShortClip {
  const start = Math.max(0, Math.min(Number(c.start) || 0, Math.max(0, max - 5)));
  const rawEnd = Number(c.end) || start + 35;
  const end = Math.max(start + 5, Math.min(rawEnd, max || rawEnd));
  return {
    id: crypto.randomUUID(),
    title: String(c.title || `Short ${i + 1}`),
    start,
    end,
    reason: String(c.reason || "Selected from the transcript."),
    socialCaption: String(c.socialCaption || "#Punjabi #Reels #Shorts"),
    score: Math.max(0, Math.min(100, Number(c.score) || 70)),
  };
}

export default function Home() {
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);
  const [latest, setLatest] = useState<LatestVideo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [clips, setClips] = useState<ShortClip[]>([]);
  const [rendered, setRendered] = useState<Rendered>({});
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");
  const [instagramUrl, setInstagramUrl] = useState("https://www.instagram.com/");
  const [facebookUrl, setFacebookUrl] = useState("https://www.facebook.com/");

  const ffmpegRef = useRef<FFmpegLike | null>(null);
  const sourceReadyRef = useRef(false);
  const fontReadyRef = useRef(false);
  const sourceNameRef = useRef("source.mp4");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("iside-shorts-settings") || "{}");
      if (saved.channel) setChannel(saved.channel);
      if (saved.instagramUrl) setInstagramUrl(saved.instagramUrl);
      if (saved.facebookUrl) setFacebookUrl(saved.facebookUrl);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("iside-shorts-settings", JSON.stringify({ channel, instagramUrl, facebookUrl }));
  }, [channel, instagramUrl, facebookUrl]);

  const canAnalyze = !!file && !busy;
  const totalReady = Object.keys(rendered).length;

  async function fetchLatest() {
    setError(""); setBusy("youtube"); setStatus("Fetching latest YouTube upload…");
    try {
      const r = await fetch(`/api/youtube/latest?channel=${encodeURIComponent(channel)}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "YouTube lookup failed.");
      setLatest(data); setStatus("Latest upload found");
    } catch (e) { setError(e instanceof Error ? e.message : "YouTube lookup failed."); setStatus("Ready"); }
    finally { setBusy(""); }
  }

  async function selectVideo(next: File | null) {
    if (!next) return;
    setError(""); setFile(next); setSegments([]); setClips([]); setRendered({});
    sourceReadyRef.current = false; fontReadyRef.current = false;
    const ext = next.name.split(".").pop()?.toLowerCase() || "mp4";
    sourceNameRef.current = `source.${ext.replace(/[^a-z0-9]/g, "") || "mp4"}`;
    try { setDuration(await getVideoDuration(next)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not read video."); }
  }

  async function loadFFmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current;
    setStatus("Loading local video engine (~30 MB once)…");
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
    const ffmpeg: any = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }: any) => {
      if (Number.isFinite(p)) setProgress(Math.max(0, Math.min(99, Math.round(p * 100))));
    });
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }

  async function ensureSource(ffmpeg: FFmpegLike) {
    if (sourceReadyRef.current || !file) return;
    const { fetchFile } = await import("@ffmpeg/util");
    setStatus("Loading your master video locally…");
    await ffmpeg.writeFile(sourceNameRef.current, await fetchFile(file));
    sourceReadyRef.current = true;
  }

  async function cleanTranscript(raw: TranscriptSegment[]) {
    const out = [...raw];
    for (let i = 0; i < out.length; i += 35) {
      const batch = out.slice(i, i + 35);
      try {
        const r = await fetch("/api/ai/clean", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts: batch.map(x => x.text) }) });
        const data = await r.json();
        if (Array.isArray(data.texts) && data.texts.length === batch.length) data.texts.forEach((t: string, j: number) => out[i + j] = { ...out[i + j], text: t });
      } catch {}
    }
    return out;
  }

  async function analyzeVideo() {
    if (!file) return;
    setError(""); setBusy("analyze"); setProgress(0); setSegments([]); setClips([]); setRendered({});
    try {
      const ffmpeg = await loadFFmpeg();
      await ensureSource(ffmpeg);
      const chunkSeconds = 180;
      const transcript: TranscriptSegment[] = [];
      const count = Math.ceil(duration / chunkSeconds);
      for (let i = 0; i < count; i++) {
        const offset = i * chunkSeconds;
        const len = Math.min(chunkSeconds, duration - offset);
        const audioName = `audio-${i}.mp3`;
        setStatus(`Transcribing Punjabi audio ${i + 1}/${count}…`);
        setProgress(Math.round((i / Math.max(1, count)) * 55));
        await ffmpeg.exec(["-ss", String(offset), "-t", String(len), "-i", sourceNameRef.current, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "24k", audioName]);
        const audio = await ffmpeg.readFile(audioName);
        const blob = new Blob([audio as BlobPart], { type: "audio/mpeg" });
        const form = new FormData();
        form.append("file", new File([blob], audioName, { type: "audio/mpeg" }));
        form.append("offset", String(offset));
        const r = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await r.json();
        await ffmpeg.deleteFile(audioName).catch(() => {});
        if (!r.ok) throw new Error(data.error || "Punjabi transcription failed.");
        transcript.push(...(data.segments || []));
      }
      setStatus("Correcting Punjabi captions…"); setProgress(65);
      const cleaned = await cleanTranscript(transcript);
      setSegments(cleaned);
      setStatus("Choosing four strongest short-form moments…"); setProgress(78);
      const pick = await fetch("/api/ai/shorts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ segments: cleaned, videoTitle: latest?.title || file.name }) });
      const picked = await pick.json();
      if (!pick.ok) throw new Error(picked.error || "Could not select clips.");
      const nextClips = (picked.clips || []).slice(0, 4).map((c: any, i: number) => clampClip(c, duration, i));
      setClips(nextClips);
      setProgress(100); setStatus("4 shorts selected — review and render them");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStatus("Ready"); setProgress(0);
    } finally { setBusy(""); }
  }

  async function ensureFont(ffmpeg: FFmpegLike) {
    if (fontReadyRef.current) return;
    const { fetchFile } = await import("@ffmpeg/util");
    setStatus("Loading Punjabi caption font…");
    await ffmpeg.writeFile("gurmukhi.ttf", await fetchFile(FONT_URL));
    fontReadyRef.current = true;
  }

  async function renderClip(clip: ShortClip) {
    if (!file) return;
    setError(""); setBusy(`render-${clip.id}`); setProgress(0);
    const outputName = `short-${clips.findIndex(c => c.id === clip.id) + 1}.mp4`;
    const capNames: string[] = [];
    try {
      const ffmpeg = await loadFFmpeg();
      await ensureSource(ffmpeg);
      await ensureFont(ffmpeg);
      const active = segments.filter(s => s.end > clip.start && s.start < clip.end).slice(0, 24);
      const draws: string[] = [];
      for (let i = 0; i < active.length; i++) {
        const s = active[i];
        const cap = `cap-${clip.id}-${i}.txt`;
        capNames.push(cap);
        await ffmpeg.writeFile(cap, new TextEncoder().encode(wrapPunjabi(s.text)));
        const a = Math.max(0, s.start - clip.start).toFixed(2);
        const b = Math.min(clip.end - clip.start, s.end - clip.start).toFixed(2);
        draws.push(`drawtext=fontfile=/gurmukhi.ttf:textfile=/${cap}:fontcolor=white:fontsize=62:borderw=4:bordercolor=black@0.95:box=1:boxcolor=black@0.45:boxborderw=24:line_spacing=8:x=(w-text_w)/2:y=h*0.76:enable='between(t\\,${a}\\,${b})'`);
      }
      const captions = draws.length ? `,${draws.join(",")}` : "";
      const filter = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=16:2[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2${captions}[v]`;
      setStatus(`Rendering ${clip.title} locally…`);
      await ffmpeg.exec([
        "-ss", String(clip.start), "-t", String(clip.end - clip.start), "-i", sourceNameRef.current,
        "-filter_complex", filter,
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outputName,
      ]);
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as BlobPart], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setRendered(old => {
        if (old[clip.id]?.url) URL.revokeObjectURL(old[clip.id].url);
        return { ...old, [clip.id]: { url, fileName: outputName } };
      });
      await ffmpeg.deleteFile(outputName).catch(() => {});
      setProgress(100); setStatus(`${clip.title} is ready`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rendering failed.");
      setStatus("Render failed");
    } finally {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) for (const cap of capNames) await ffmpeg.deleteFile(cap).catch(() => {});
      setBusy("");
    }
  }

  async function renderAll() {
    for (const clip of clips) if (!rendered[clip.id]) await renderClip(clip);
  }

  async function copyCaption(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Caption copied");
  }

  function downloadRendered(clip: ShortClip) {
    const item = rendered[clip.id]; if (!item) return;
    const a = document.createElement("a"); a.href = item.url; a.download = item.fileName; a.click();
  }

  async function handoff(clip: ShortClip, target: "instagram" | "facebook") {
    const item = rendered[clip.id];
    if (!item) { setError("Render this short first."); return; }
    try {
      const blob = await fetch(item.url).then(r => r.blob());
      const media = new File([blob], item.fileName, { type: "video/mp4" });
      const nav = navigator as any;
      if (nav.share && nav.canShare?.({ files: [media] })) {
        await nav.share({ files: [media], text: clip.socialCaption, title: clip.title });
        setStatus(`Share sheet opened — choose ${target === "instagram" ? "Instagram" : "Facebook"} and press the final Post button there.`);
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
    await navigator.clipboard.writeText(clip.socialCaption).catch(() => {});
    downloadRendered(clip);
    window.open(target === "instagram" ? instagramUrl : facebookUrl, "_blank", "noopener,noreferrer");
    setStatus("Desktop fallback: video downloaded, caption copied, and the social site opened in a new tab.");
  }

  function updateClip(id: string, patch: Partial<ShortClip>) {
    setClips(old => old.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  return (
    <main>
      <header className="topbar">
        <div className="shell topin">
          <div className="brand"><div className="logo"><Scissors size={19}/></div><div><b>iSide Shorts Studio</b><span>YouTube → Punjabi Reels</span></div></div>
          <div className="live"><span/> Manual final-post mode</div>
        </div>
      </header>

      <div className="shell">
        <section className="hero">
          <div>
            <div className="eyebrow"><Sparkles size={14}/> ZERO-AUTO-POST WORKFLOW</div>
            <h1>One long video.<br/><em>Four ready-to-post shorts.</em></h1>
            <p>Fetch your latest YouTube upload, analyze the original master video, generate four vertical clips with Punjabi captions, then hand each one to Instagram or Facebook. You keep the final Post button.</p>
          </div>
          <div className="heroStats">
            <div><b>4</b><span>shorts per upload</span></div>
            <div><b>9:16</b><span>vertical MP4</span></div>
            <div><b>ਪੰਜਾਬੀ</b><span>burned captions</span></div>
          </div>
        </section>

        <section className="grid2">
          <div className="panel">
            <div className="panelTitle"><Youtube size={19}/><div><b>1. YouTube source</b><span>Public channel link — no login required</span></div></div>
            <label>Channel URL or @handle</label>
            <div className="inputRow"><input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="https://youtube.com/@channel"/><button onClick={fetchLatest} disabled={!!busy}>{busy === "youtube" ? <LoaderCircle className="spin"/> : <RefreshCcw size={17}/>} Fetch latest</button></div>
            {latest && <div className="latest"><img src={latest.thumbnail} alt=""/><div><span className="pill">LATEST UPLOAD</span><b>{latest.title}</b><small>{latest.channelTitle} · {new Date(latest.published).toLocaleString()}</small><a href={latest.url} target="_blank">Open on YouTube <ArrowUpRight size={13}/></a></div></div>}
          </div>

          <div className="panel">
            <div className="panelTitle"><FileVideo size={19}/><div><b>2. Original master video</b><span>The actual file stays in your browser</span></div></div>
            <label className="drop">
              <input type="file" accept="video/*" onChange={e=>selectVideo(e.target.files?.[0] || null)}/>
              <Upload size={24}/><b>{file ? file.name : "Choose the original video"}</b>
              <span>{file ? `${(file.size / 1073741824).toFixed(2)} GB · ${fmtTime(duration)}` : "MP4 / MOV / MKV / WebM"}</span>
            </label>
            <button className="wide primary" disabled={!canAnalyze} onClick={analyzeVideo}>{busy === "analyze" ? <LoaderCircle className="spin"/> : <Sparkles size={17}/>} Analyze Punjabi & pick 4 shorts</button>
          </div>
        </section>

        <section className="panel workspace">
          <div className="workspaceHead">
            <div className="panelTitle"><Clapperboard size={19}/><div><b>3. Shorts workspace</b><span>Edit timings before rendering</span></div></div>
            <div className="statusline"><span>{status}</span>{progress > 0 && progress < 100 && <div className="bar"><i style={{width:`${progress}%`}}/></div>}</div>
          </div>
          {error && <div className="error">{error}</div>}
          {!clips.length ? <div className="empty"><Scissors size={34}/><b>Your 4 shorts will appear here</b><span>Fetch the latest upload, choose its original master file, then run analysis.</span></div> : <>
            <div className="cards">
              {clips.map((clip, index) => {
                const ready = rendered[clip.id];
                return <article className="shortCard" key={clip.id}>
                  <div className="shortTop"><span className="number">0{index + 1}</span><span className="score">AI pick {clip.score}/100</span></div>
                  <input className="titleInput" value={clip.title} onChange={e=>updateClip(clip.id,{title:e.target.value})}/>
                  <p>{clip.reason}</p>
                  <div className="timings"><label>Start<input type="number" step="0.1" value={clip.start.toFixed(1)} onChange={e=>updateClip(clip.id,{start:Number(e.target.value)})}/></label><label>End<input type="number" step="0.1" value={clip.end.toFixed(1)} onChange={e=>updateClip(clip.id,{end:Number(e.target.value)})}/></label><span>{Math.max(0, clip.end-clip.start).toFixed(0)}s</span></div>
                  <textarea value={clip.socialCaption} onChange={e=>updateClip(clip.id,{socialCaption:e.target.value})}/>
                  {ready ? <video className="preview" src={ready.url} controls playsInline/> : <div className="preview placeholder"><Play size={26}/><span>Render to preview</span></div>}
                  <div className="cardActions">
                    <button onClick={()=>renderClip(clip)} disabled={!!busy}>{busy === `render-${clip.id}` ? <LoaderCircle className="spin"/> : <Clapperboard size={15}/>} {ready ? "Re-render" : "Render"}</button>
                    <button onClick={()=>copyCaption(clip.socialCaption)}><Copy size={15}/> Caption</button>
                    {ready && <button onClick={()=>downloadRendered(clip)}><Download size={15}/> MP4</button>}
                  </div>
                  <div className="shareRow">
                    <button className="insta" disabled={!ready} onClick={()=>handoff(clip,"instagram")}><Instagram size={16}/> Instagram</button>
                    <button className="fb" disabled={!ready} onClick={()=>handoff(clip,"facebook")}><Facebook size={16}/> Facebook</button>
                  </div>
                </article>
              })}
            </div>
            <button className="wide primary renderAll" onClick={renderAll} disabled={!!busy || totalReady === clips.length}><Clapperboard size={17}/> Render all remaining shorts ({clips.length - totalReady})</button>
          </>}
        </section>

        <section className="grid2 settings">
          <div className="panel">
            <div className="panelTitle"><Instagram size={19}/><div><b>Instagram handoff</b><span>Used for desktop fallback</span></div></div>
            <label>Instagram URL</label><input value={instagramUrl} onChange={e=>setInstagramUrl(e.target.value)} />
            <p className="hint">On supported phones the button opens the native share sheet with the MP4 + caption. On desktop it downloads the MP4, copies the caption, and opens Instagram.</p>
          </div>
          <div className="panel">
            <div className="panelTitle"><Facebook size={19}/><div><b>Facebook handoff</b><span>Used for desktop fallback</span></div></div>
            <label>Facebook URL</label><input value={facebookUrl} onChange={e=>setFacebookUrl(e.target.value)} />
            <p className="hint">No Meta token is stored because this version never auto-publishes. The final Post action always stays with you.</p>
          </div>
        </section>

        <footer><span>iSide Shorts Studio · Browser-first video processing</span><a href="https://github.com/anshdeepofficial1/iSide" target="_blank">GitHub <ExternalLink size={12}/></a></footer>
      </div>
    </main>
  );
}
