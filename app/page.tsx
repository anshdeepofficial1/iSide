"use client";
import { useEffect, useState } from "react";
import JSZip from "jszip";
import plist from "plist";
// @ts-ignore
import bplist from "bplist-parser";
import { Buffer } from "buffer";
import { UploadCloud, ShieldCheck, Smartphone, BellRing, ArrowRight, X, CheckCircle2 } from "lucide-react";

type AppMeta={name:string;bundleId:string;version:string;build:string;minIOS:string;icon?:string;fileName:string;size:number};

function Navbar(){return <div className="nav"><div className="wrap"><div className="navin"><a className="brand" href="/"><img src="/icon.svg" alt="iSide"/><span>iSide</span></a><div className="navlinks"><a href="#install">Install</a><a href="/manager">Manager</a><a href="/privacy">Privacy</a><a href="https://github.com/anshdeepofficial1/iSide" target="_blank">GitHub</a></div></div></div></div>}
function Footer(){return <div className="footer"><div className="wrap"><div className="footin"><span>iSide · IPA Installer & Manager</span><span>Files are analyzed locally before signing.</span></div></div></div>}
async function toDataUrl(blob:Blob){return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob)})}
async function analyzeIPA(file:File):Promise<AppMeta>{
 const zip=await JSZip.loadAsync(file);
 const infoPath=Object.keys(zip.files).find(p=>/^Payload\/[^/]+\.app\/Info\.plist$/i.test(p));
 if(!infoPath)throw new Error("This file does not contain a standard iOS app bundle.");
 const bytes=await zip.file(infoPath)!.async("uint8array");
 const header=new TextDecoder().decode(bytes.slice(0,8));
 let info:any;
 if(header==="bplist00")info=bplist.parseBuffer(Buffer.from(bytes))[0]; else info=plist.parse(new TextDecoder().decode(bytes));
 const root=infoPath.slice(0,infoPath.lastIndexOf("/")+1);
 const pngs=Object.keys(zip.files).filter(p=>p.startsWith(root)&&/\.png$/i.test(p));
 const preferred=pngs.find(p=>/AppIcon/i.test(p))||pngs.find(p=>/Icon/i.test(p));
 let icon:string|undefined;
 if(preferred){try{icon=await toDataUrl(await zip.file(preferred)!.async("blob"))}catch{}}
 return {name:String(info.CFBundleDisplayName||info.CFBundleName||file.name.replace(/\.ipa$/i,"")),bundleId:String(info.CFBundleIdentifier||"Unknown"),version:String(info.CFBundleShortVersionString||"Unknown"),build:String(info.CFBundleVersion||"Unknown"),minIOS:String(info.MinimumOSVersion||"Unknown"),icon,fileName:file.name,size:file.size};
}
function githubRepoFrom(value:string){try{const u=new URL(value);if(u.hostname!=="github.com")return null;const p=u.pathname.split("/").filter(Boolean);return p.length>=2?p[0]+"/"+p[1].replace(/\.git$/,""):null}catch{return /^[\w.-]+\/[\w.-]+$/.test(value)?value:null}}
function isStandalone(){if(typeof window==="undefined")return false;return window.matchMedia("(display-mode: standalone)").matches||(navigator as any).standalone===true}
function isIOS(){if(typeof navigator==="undefined")return false;return /iPhone|iPad|iPod/i.test(navigator.userAgent)}

export default function Home(){
 const [standalone,setStandalone]=useState(false),[ios,setIos]=useState(false),[showPwa,setShowPwa]=useState(false);
 const [file,setFile]=useState<File|null>(null),[meta,setMeta]=useState<AppMeta|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [source,setSource]=useState(""),[signingConfigured,setSigningConfigured]=useState(false),[signStatus,setSignStatus]=useState("");
 useEffect(()=>{setStandalone(isStandalone());setIos(isIOS());fetch("/api/config").then(r=>r.json()).then(x=>setSigningConfigured(!!x.signingConfigured)).catch(()=>{});},[]);
 const pwaReady=standalone||!ios;
 async function select(f?:File){if(!f)return;setError("");setMeta(null);setFile(f);setBusy(true);try{if(!f.name.toLowerCase().endsWith(".ipa"))throw new Error("Please choose an .ipa file.");setMeta(await analyzeIPA(f));}catch(e:any){setError(e?.message||"Could not read this IPA.")}finally{setBusy(false)}}
 async function startSigning(){
  if(!file||!meta)return;
  if(!signingConfigured){setError("The iSide signing service is not connected yet. Local IPA analysis and Manager work now, but Sign & Install needs the signing backend.");return}
  setBusy(true);setError("");setSignStatus("Creating secure signing session…");
  try{
   const sourceRepo=githubRepoFrom(source);
   const s=await fetch("/api/signing/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({app:meta,updateSource:sourceRepo?{type:"github",repo:sourceRepo}:null})});
   const session=await s.json();if(!s.ok)throw new Error(session.error||"Could not create signing session.");
   setSignStatus("Uploading IPA directly to signing storage…");
   const put=await fetch(session.uploadUrl,{method:session.uploadMethod||"PUT",headers:session.uploadHeaders||{},body:file});if(!put.ok)throw new Error("IPA upload failed.");
   setSignStatus("Signing IPA…");
   const c=await fetch("/api/signing/complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session.sessionId})});
   let result=await c.json();if(!c.ok)throw new Error(result.error||"Signing could not start.");
   for(let i=0;i<60&&!["ready","failed"].includes(result.status);i++){await new Promise(r=>setTimeout(r,2000));const q=await fetch("/api/signing/status?sessionId="+encodeURIComponent(session.sessionId),{cache:"no-store"});result=await q.json();}
   if(result.status!=="ready"||!result.installUrl)throw new Error(result.error||"Signing did not complete.");
   const record={id:crypto.randomUUID(),app:meta,updateSource:sourceRepo?{type:"github",repo:sourceRepo}:null,signing:result.signing||null,installedAt:new Date().toISOString()};
   const old=JSON.parse(localStorage.getItem("iside.apps")||"[]");localStorage.setItem("iside.apps",JSON.stringify([record,...old.filter((x:any)=>x.app?.bundleId!==meta.bundleId)]));
   setSignStatus("Ready. Opening iOS installer…");window.location.href=result.installUrl;
  }catch(e:any){setError(e?.message||"Installation failed.");setSignStatus("")}finally{setBusy(false)}
 }
 return <><Navbar/><main>
 <div className="wrap"><div className="hero"><div><div className="eyebrow"><span className="dot"/> IPA INSTALLER · PWA MANAGER</div><h1>Install smarter.<br/><span style={{color:"var(--cyan)"}}>Stay informed.</span></h1><p className="lead">iSide gives iPhone and iPad users one clean place to prepare an IPA installation, track app updates, and watch signing expiry before it becomes a problem.</p><div className="actions"><a className="btn primary" href="#install">Start installation <ArrowRight size={18}/></a><a className="btn secondary" href="/manager">Open iSide Manager</a></div></div>
 <div className="glass heroCard"><div className="appTop"><div><div className="tiny">iSIDE MANAGER</div><h3 style={{fontSize:24,marginTop:5}}>Your install health at a glance</h3></div><ShieldCheck color="var(--cyan)" size={28}/></div><div className="minirow"><div className="metric"><b>App updates</b><span>Source-aware tracking</span></div><div className="metric"><b>Signing</b><span>Expiry countdown</span></div><div className="metric"><b>PWA</b><span>Independent recovery hub</span></div></div><div className="notice">iSide Manager stays available as a Home Screen web app even when a sideloaded app needs attention.</div></div></div></div>
 <section className="section"><div className="wrap"><h2>Three steps. No certificate jargon.</h2><p className="lead">The technical details stay behind the interface.</p><div className="steps"><div className="step"><div className="num">1</div><h3>Add iSide first</h3><p>Save iSide Manager to the Home Screen before installing an IPA.</p></div><div className="step"><div className="num">2</div><h3>Choose your IPA</h3><p>iSide reads app metadata locally. Add a GitHub source only if update tracking is wanted.</p></div><div className="step"><div className="num">3</div><h3>Sign & install</h3><p>The configured signer returns the iOS install link plus signing-expiry data for Manager.</p></div></div></div></section>
 <section id="install" className="section"><div className="wrap"><div className="appTop" style={{marginBottom:18}}><div><div className="eyebrow"><Smartphone size={14}/> INSTALL WORKFLOW</div><h2 style={{marginTop:14}}>Prepare an app</h2></div><span className={"status "+(signingConfigured?"good":"warn")}>{signingConfigured?"Signing service connected":"Signing service not connected"}</span></div>
 {!pwaReady&&<div className="glass" style={{padding:22,marginBottom:16}}><div className="appTop"><div><h3>First, add iSide to your Home Screen</h3><p className="muted">This keeps iSide Manager available before you install the selected app.</p></div><BellRing color="var(--cyan)"/></div><div className="actions"><button className="btn primary" onClick={()=>setShowPwa(true)}>Show me how</button></div></div>}
 <div className="installer"><div className={"drop"+(busy?" drag":"")}><input aria-label="Choose IPA" type="file" accept=".ipa" disabled={!pwaReady||busy} onChange={e=>select(e.target.files?.[0])}/><div className="uploadIcon"><UploadCloud size={30} color="var(--cyan)"/></div><h3>{busy&&!meta?"Reading IPA…":"Choose an IPA file"}</h3><p className="muted">Tap here and select the app you want to prepare. Metadata is read locally in your browser.</p>{file&&<div className="tiny">{file.name} · {(file.size/1048576).toFixed(1)} MB</div>}</div>
 <div className="glass detail">{meta?<><div className="appTop"><div style={{display:"flex",gap:14,alignItems:"center"}}><div className="appIcon">{meta.icon?<img src={meta.icon} alt=""/>:<span>iS</span>}</div><div><h3 style={{fontSize:22}}>{meta.name}</h3><div className="tiny">{meta.bundleId}</div></div></div><CheckCircle2 color="var(--good)"/></div><div style={{marginTop:18}}><div className="kv"><span>Version</span><span>{meta.version} ({meta.build})</span></div><div className="kv"><span>Minimum iOS</span><span>{meta.minIOS}</span></div><div className="kv"><span>IPA size</span><span>{(meta.size/1048576).toFixed(1)} MB</span></div></div><div className="source"><label className="tiny">Optional update source</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="GitHub repo URL or owner/repository"/></div><p className="tiny">No source means signing health only. iSide does not guess an update source.</p><div className="actions"><button className="btn primary" disabled={busy} onClick={startSigning}><ShieldCheck size={18}/>{busy?"Working…":"Sign & Install"}</button><button className="btn ghost" disabled={busy} onClick={()=>{setFile(null);setMeta(null);setError("");setSignStatus("")}}>Clear</button></div>{signStatus&&<div className="notice">{signStatus}</div>}</>:<div className="empty"><ShieldCheck size={36}/><h3 style={{marginTop:14}}>App details appear here</h3><p>Nothing is uploaded until you explicitly start signing.</p></div>}{error&&<div className="notice" style={{borderColor:"#69343a",color:"#ffb6bd"}}>{error}</div>}</div></div></div></section>
 </main><Footer/>
 {showPwa&&<div className="modalback" onClick={()=>setShowPwa(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="appTop"><div><div className="tiny">ONE-TIME SETUP</div><h2 style={{fontSize:28,marginTop:5}}>Add iSide to Home Screen</h2></div><button className="btn ghost" style={{width:48,padding:0}} onClick={()=>setShowPwa(false)}><X/></button></div><ol><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>, then open iSide from the Home Screen.</li></ol><div className="notice">Safari requires this user action. Once iSide is opened from the Home Screen, the IPA step unlocks.</div></div></div>}
 </>;
}
