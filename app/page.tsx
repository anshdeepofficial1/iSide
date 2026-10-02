"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  FileVideo,
  Instagram,
  LoaderCircle,
  Scissors,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";

type FFmpegLike = {
  load: (o: any) => Promise<boolean>;
  writeFile: (name: string, data: any) => Promise<void>;
  readFile: (name: string) => Promise<any>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, cb: (payload: any) => void) => void;
};

type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  caption: string;
  time: string;
};

type Rendered = Record<string, { url: string; fileName: string }>;

const DEFAULT_TIMES = ["09:00", "13:00", "17:00", "20:30"];
const IG_URL = "https://www.instagram.com/";
const FB_URL = "https://www.facebook.com/";
const META_SUITE = "https://business.facebook.com/";

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(d) ? resolve(d) : reject(new Error("Could not read video duration."));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open this video."));
    };
    v.src = url;
  });
}

function makeAutoClips(duration: number): Clip[] {
  const safeDuration = Math.max(1, duration);

  if (safeDuration < 100) {
    const part = safeDuration / 4;
    return Array.from({ length: 4 }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `Short ${i + 1}`,
      start: i * part,
      end: Math.min(safeDuration, (i + 1) * part),
      caption: "",
      time: DEFAULT_TIMES[i],
    }));
  }

  const len = Math.min(45, Math.max(25, safeDuration / 10));
  const anchors = [0.08, 0.33, 0.58, 0.82];

  return anchors.map((p, i) => {
    const start = Math.max(0, Math.min(safeDuration - len, safeDuration * p));
    return {
      id: crypto.randomUUID(),
      title: `Short ${i + 1}`,
      start,
      end: Math.min(safeDuration, start + len),
      caption: "",
      time: DEFAULT_TIMES[i],
    };
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [rendered, setRendered] = useState<Rendered>({});
  const [scheduleDate, setScheduleDate] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("Upload a long video to begin.");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const ffmpegRef = useRef<FFmpegLike | null>(null);
  const sourceLoadedRef = useRef(false);
  const sourceNameRef = useRef("source.mp4");

  useEffect(() => {
    setScheduleDate(tomorrowISO());
  }, []);

  async function selectVideo(next: File | null) {
    if (!next) return;
    setError("");
    setFile(next);
    setClips([]);
    setRendered({});
    setProgress(0);
    sourceLoadedRef.current = false;
    const ext = next.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    sourceNameRef.current = `source.${ext}`;

    try {
      const d = await readDuration(next);
      setDuration(d);
      setStatus(`Ready: ${next.name} · ${fmt(d)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read video.");
    }
  }

  async function loadFFmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current;
    setStatus("Loading local video engine…");
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);

    const ffmpeg: any = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }: any) => {
      if (Number.isFinite(p)) setProgress(Math.max(0, Math.min(99, Math.round(p * 100))));
    });

    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }

  async function ensureSource(ffmpeg: FFmpegLike) {
    if (!file || sourceLoadedRef.current) return;
    const { fetchFile } = await import("@ffmpeg/util");
    setStatus("Loading your video locally…");
    await ffmpeg.writeFile(sourceNameRef.current, await fetchFile(file));
    sourceLoadedRef.current = true;
  }

  async function renderOne(ffmpeg: FFmpegLike, clip: Clip, index: number) {
    const name = `short-${index + 1}.mp4`;
    const length = Math.max(3, clip.end - clip.start);

    setStatus(`Creating Short ${index + 1}/4…`);
    setProgress(0);

    const filter =
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:4[bg];" +
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];" +
      "[bg][fg]overlay=(W-w)/2:(H-h)/2[v]";

    await ffmpeg.exec([
      "-ss", String(clip.start),
      "-t", String(length),
      "-i", sourceNameRef.current,
      "-filter_complex", filter,
      "-map", "[v]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "24",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      name,
    ]);

    const out = await ffmpeg.readFile(name);
    const blob = new Blob([out as BlobPart], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    setRendered(old => {
      const previous = old[clip.id]?.url;
      if (previous) URL.revokeObjectURL(previous);
      return { ...old, [clip.id]: { url, fileName: name } };
    });

    await ffmpeg.deleteFile(name).catch(() => {});
  }

  async function createFourShorts() {
    if (!file || !duration) return;

    setError("");
    setBusy("create");
    setRendered({});
    setProgress(0);

    try {
      const auto = makeAutoClips(duration);
      setClips(auto);

      const ffmpeg = await loadFFmpeg();
      await ensureSource(ffmpeg);

      for (let i = 0; i < auto.length; i++) {
        await renderOne(ffmpeg, auto[i], i);
      }

      setProgress(100);
      setStatus("All 4 shorts are ready. Review, edit timing if needed, then share.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create shorts.");
      setStatus("Creation stopped.");
    } finally {
      setBusy("");
    }
  }

  async function rerender(clip: Clip, index: number) {
    if (!file) return;
    setError("");
    setBusy(`render-${clip.id}`);
    try {
      const ffmpeg = await loadFFmpeg();
      await ensureSource(ffmpeg);
      await renderOne(ffmpeg, clip, index);
      setStatus(`Short ${index + 1} updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not render short.");
    } finally {
      setBusy("");
    }
  }

  function updateClip(id: string, patch: Partial<Clip>) {
    setClips(old => old.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  function downloadClip(clip: Clip) {
    const item = rendered[clip.id];
    if (!item) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.fileName;
    a.click();
  }

  async function copyCaption(clip: Clip) {
    if (!clip.caption.trim()) {
      setStatus("Caption is empty — add one if you want to copy it.");
      return;
    }
    await navigator.clipboard.writeText(clip.caption);
    setStatus("Caption copied.");
  }

  async function shareClip(clip: Clip, target: "instagram" | "facebook") {
    const item = rendered[clip.id];
    if (!item) {
      setError("This short is not rendered yet.");
      return;
    }

    try {
      const blob = await fetch(item.url).then(r => r.blob());
      const media = new File([blob], item.fileName, { type: "video/mp4" });
      const nav = navigator as any;

      if (nav.share && nav.canShare?.({ files: [media] })) {
        await nav.share({
          files: [media],
          text: clip.caption || undefined,
          title: `${clip.title} · ${scheduleDate} ${clip.time}`,
        });
        setStatus(
          `Video handed to the phone share sheet. Choose ${target === "instagram" ? "Instagram" : "Facebook"}, then set ${scheduleDate} at ${clip.time} inside the app.`
        );
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }

    if (clip.caption.trim()) {
      await navigator.clipboard.writeText(clip.caption).catch(() => {});
    }
    downloadClip(clip);
    window.open(target === "instagram" ? IG_URL : FB_URL, "_blank", "noopener,noreferrer");
    setStatus(
      `Desktop mode: MP4 downloaded${clip.caption.trim() ? ", caption copied" : ""}, and ${target === "instagram" ? "Instagram" : "Facebook"} opened. Set ${scheduleDate} at ${clip.time} there.`
    );
  }

  function copySchedule() {
    const text = clips
      .map((c, i) => `Short ${i + 1}: ${scheduleDate} at ${c.time}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setStatus("4-slot schedule copied.");
  }

  return (
    <main>
      <header className="topbar">
        <div className="shell topin">
          <div className="brand">
            <div className="logo"><Scissors size={19}/></div>
            <div>
              <b>iSide Shorts Studio</b>
              <span>Local video → 4 ready reels</span>
            </div>
          </div>
          <div className="live"><span/> No API keys</div>
        </div>
      </header>

      <div className="shell">
        <section className="hero">
          <div>
            <div className="eyebrow"><Sparkles size={14}/> 100% LOCAL PROCESSING</div>
            <h1>Upload one video.<br/><em>Get four ready reels.</em></h1>
            <p>
              No YouTube fetch, no Groq key, no Meta API. Your browser creates four separate
              vertical MP4s locally. Then you share each one to Instagram or Facebook and set
              the final schedule inside the platform.
            </p>
          </div>

          <div className="heroStats">
            <div><b>4</b><span>auto-created shorts</span></div>
            <div><b>9:16</b><span>vertical MP4</span></div>
            <div><b>0</b><span>API keys required</span></div>
          </div>
        </section>

        <section className="panel uploadPanel">
          <div className="panelTitle">
            <FileVideo size={19}/>
            <div>
              <b>1. Upload your long video</b>
              <span>The source stays on your device</span>
            </div>
          </div>

          <label className="drop">
            <input
              type="file"
              accept="video/*"
              onChange={e => selectVideo(e.target.files?.[0] || null)}
            />
            <Upload size={28}/>
            <b>{file ? file.name : "Choose a video"}</b>
            <span>{file ? `${(file.size / 1048576).toFixed(1)} MB · ${fmt(duration)}` : "MP4 / MOV / MKV / WebM"}</span>
          </label>

          <button
            className="wide primary createBtn"
            disabled={!file || !duration || !!busy}
            onClick={createFourShorts}
          >
            {busy === "create" ? <LoaderCircle className="spin"/> : <Clapperboard size={18}/>}
            {busy === "create" ? "Creating 4 Shorts…" : "Create 4 Shorts"}
          </button>

          <div className="statusBox">
            <span>{status}</span>
            {progress > 0 && progress < 100 && <div className="bar"><i style={{ width: `${progress}%` }}/></div>}
          </div>

          {error && <div className="error">{error}</div>}
        </section>

        <section className="panel schedulePanel">
          <div className="panelTitle">
            <CalendarDays size={19}/>
            <div>
              <b>2. Posting day</b>
              <span>All 4 reels stay on the same day, with separate time slots</span>
            </div>
          </div>

          <div className="scheduleHead">
            <div>
              <label>Schedule date</label>
              <input
                type="date"
                value={scheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setScheduleDate(e.target.value)}
              />
            </div>
            <button className="secondaryBtn" disabled={!clips.length} onClick={copySchedule}>
              <Copy size={15}/> Copy 4-slot schedule
            </button>
            <a className="secondaryBtn" href={META_SUITE} target="_blank">
              <ExternalLink size={15}/> Open Meta Business Suite
            </a>
          </div>

          <p className="hint">
            The four default times are editable. With no Meta API, this site cannot press Instagram/Facebook's
            future-schedule control for you; it prepares the files and hands them off, while you set the shown
            date/time inside Instagram, Facebook, or Meta Business Suite.
          </p>
        </section>

        <section className="panel workspace">
          <div className="panelTitle">
            <Clapperboard size={19}/>
            <div>
              <b>3. Your 4 Shorts</b>
              <span>Edit start/end, caption, and time before sharing</span>
            </div>
          </div>

          {!clips.length ? (
            <div className="empty">
              <Scissors size={34}/>
              <b>No shorts yet</b>
              <span>Upload a video and press Create 4 Shorts.</span>
            </div>
          ) : (
            <div className="cards">
              {clips.map((clip, index) => {
                const item = rendered[clip.id];
                return (
                  <article className="shortCard" key={clip.id}>
                    <div className="shortTop">
                      <span className="number">0{index + 1}</span>
                      <span className="slot">{scheduleDate || "Date"} · {clip.time}</span>
                    </div>

                    <input
                      className="titleInput"
                      value={clip.title}
                      onChange={e => updateClip(clip.id, { title: e.target.value })}
                    />

                    <div className="timings">
                      <label>
                        Start
                        <input
                          type="number"
                          step="0.1"
                          value={clip.start.toFixed(1)}
                          onChange={e => updateClip(clip.id, { start: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        End
                        <input
                          type="number"
                          step="0.1"
                          value={clip.end.toFixed(1)}
                          onChange={e => updateClip(clip.id, { end: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Time
                        <input
                          type="time"
                          value={clip.time}
                          onChange={e => updateClip(clip.id, { time: e.target.value })}
                        />
                      </label>
                    </div>

                    <textarea
                      placeholder="Optional caption — you can also leave this blank and write it inside Instagram/Facebook."
                      value={clip.caption}
                      onChange={e => updateClip(clip.id, { caption: e.target.value })}
                    />

                    {item ? (
                      <video className="preview" src={item.url} controls playsInline/>
                    ) : (
                      <div className="preview placeholder">
                        <LoaderCircle className={busy ? "spin" : ""}/>
                        <span>{busy ? "Rendering…" : "Not rendered yet"}</span>
                      </div>
                    )}

                    <div className="cardActions">
                      <button disabled={!!busy} onClick={() => rerender(clip, index)}>
                        {busy === `render-${clip.id}` ? <LoaderCircle className="spin"/> : <Clapperboard size={15}/>}
                        Re-render
                      </button>
                      <button disabled={!item} onClick={() => downloadClip(clip)}>
                        <Download size={15}/> MP4
                      </button>
                      <button onClick={() => copyCaption(clip)}>
                        <Copy size={15}/> Caption
                      </button>
                    </div>

                    <div className="shareRow">
                      <button className="insta" disabled={!item} onClick={() => shareClip(clip, "instagram")}>
                        <Instagram size={16}/> Share to Instagram
                      </button>
                      <button className="fb" disabled={!item} onClick={() => shareClip(clip, "facebook")}>
                        <Facebook size={16}/> Share to Facebook
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel infoPanel">
          <Share2 size={20}/>
          <div>
            <b>How sharing works without APIs</b>
            <p>
              On supported phones, the actual MP4 is passed to the system share sheet so you can choose Instagram or Facebook.
              On desktop, the MP4 is downloaded and the selected social site is opened. Your final Post/Schedule action always
              stays inside Meta's own interface.
            </p>
          </div>
        </section>

        <footer>
          <span>iSide Shorts Studio · Local-only workflow</span>
          <a href="https://github.com/anshdeepofficial1/iSide" target="_blank">
            GitHub <ExternalLink size={12}/>
          </a>
        </footer>
      </div>
    </main>
  );
}
