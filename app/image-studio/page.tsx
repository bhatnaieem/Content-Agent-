"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true); setError(""); setImage(null);
    try {
      const response = await fetch("/api/image/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Image generation failed.");
      setImage(data.image);
    } catch (e) { setError(e instanceof Error ? e.message : "Image generation failed."); }
    finally { setLoading(false); }
  }

  return <main style={{minHeight:"100vh",background:"#f6f8fb",padding:"40px 20px",fontFamily:"Inter,system-ui,sans-serif",color:"#172033"}}>
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"#e6f7fb",color:"#0891b2"}}><Sparkles size={19}/></div><span style={{fontWeight:800}}>CryptoPulse AI</span></div>
      <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"22px 0 8px",letterSpacing:"-.04em"}}>Image Studio</h1>
      <p style={{color:"#64748b",maxWidth:700,lineHeight:1.6}}>Generate a social visual from the image prompt created by CryptoPulse. Your NVIDIA API key stays server-side.</p>
      <section style={{marginTop:28,background:"white",border:"1px solid #dbe4ee",borderRadius:20,padding:20,boxShadow:"0 10px 30px rgba(15,23,42,.06)"}}>
        <label style={{display:"block",fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"#64748b",marginBottom:9}}>Image prompt</label>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Paste the visual prompt generated for your X post or thread…" style={{width:"100%",minHeight:170,boxSizing:"border-box",border:"1px solid #d7e0ea",borderRadius:14,padding:14,resize:"vertical",fontSize:14,lineHeight:1.55,outline:"none"}} />
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}><button onClick={generate} disabled={loading||!prompt.trim()} style={{border:0,borderRadius:12,padding:"11px 16px",background:"#0891b2",color:"white",fontWeight:800,cursor:loading?"wait":"pointer",display:"flex",gap:8,alignItems:"center"}}>{loading?<Loader2 size={15} className="spin"/>:<ImageIcon size={15}/>} {loading?"Generating…":"Generate image"}</button><span style={{fontSize:11,color:"#94a3b8"}}>NVIDIA FLUX.2 [klein] 4B • 1024×1024</span></div>
        {error&&<div style={{marginTop:14,padding:12,borderRadius:12,background:"#fff1f2",color:"#be123c",fontSize:13}}>{error}</div>}
      </section>
      {image&&<section style={{marginTop:18,background:"white",border:"1px solid #dbe4ee",borderRadius:20,padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><strong>Generated visual</strong><div style={{fontSize:11,color:"#64748b",marginTop:3}}>Review before publishing.</div></div><a href={image} download="cryptopulse-visual.png" style={{display:"flex",gap:7,alignItems:"center",textDecoration:"none",border:"1px solid #dbe4ee",borderRadius:10,padding:"9px 12px",color:"#172033",fontSize:12,fontWeight:700}}><Download size={14}/> Save image</a></div><img src={image} alt="Generated CryptoPulse social visual" style={{display:"block",width:"100%",maxWidth:700,margin:"0 auto",borderRadius:14}} /></section>}
    </div>
    <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </main>;
}
