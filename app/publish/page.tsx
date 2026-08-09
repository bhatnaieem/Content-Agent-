"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Image as ImageIcon, Link2, Loader2, Send, ShieldCheck, Sparkles, Twitter, X } from "lucide-react";

type Channel = { id: string; name: string; displayName: string | null; service: string; isDisconnected: boolean; isLocked: boolean; isQueuePaused: boolean; externalLink: string | null };
type Workspace = { organization: { id: string; name: string; channelCount: number; limits: { channels: number; scheduledPosts: number } } | null; channels: Channel[]; plan: string; planSource: string; account: { name: string; timezone: string } };
type ThreadItem = { text: string; imageUrl: string; altText: string };
type DeliveryMode = "shareNow" | "addToQueue" | "customScheduled";

const supported = ["twitter", "facebook", "linkedin", "threads", "pinterest"];
const labels: Record<string, string> = { twitter: "X", facebook: "Facebook", linkedin: "LinkedIn", threads: "Threads", pinterest: "Pinterest" };
const emptyThread = (): ThreadItem[] => [{ text: "", imageUrl: "", altText: "" }];

function makeVariant(text: string, service: string) {
  const clean = text.trim();
  if (service === "twitter") return clean.length > 280 ? `${clean.slice(0, 276)}…` : clean;
  if (service === "threads") return clean.length > 500 ? `${clean.slice(0, 496)}…` : clean;
  if (service === "linkedin") return `${clean}\n\nWhat do you think?`;
  if (service === "pinterest") return `${clean}\n\nSave this for later.`;
  return clean;
}

export default function PublishPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [contentMode, setContentMode] = useState<"post" | "thread">("thread");
  const [source, setSource] = useState("");
  const [thread, setThread] = useState<ThreadItem[]>(emptyThread);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [mode, setMode] = useState<DeliveryMode>("addToQueue");
  const [dueAt, setDueAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/buffer/channels")
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to connect to Buffer.");
        setWorkspace(json);
        const eligible = (json.channels || []).filter((channel: Channel) => supported.includes(channel.service) && !channel.isDisconnected && !channel.isLocked);
        setSelected(eligible.slice(0, 3).map((channel: Channel) => channel.id));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to connect to Buffer."))
      .finally(() => setLoading(false));
  }, []);

  const eligible = useMemo(() => workspace?.channels.filter((channel) => supported.includes(channel.service) && !channel.isDisconnected && !channel.isLocked) || [], [workspace]);

  function toggleChannel(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  function updateThread(index: number, key: keyof ThreadItem, value: string) {
    setThread((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function buildVariants() {
    const master = contentMode === "thread" ? thread[0]?.text || "" : source;
    const next: Record<string, string> = {};
    eligible.forEach((channel) => { next[channel.id] = makeVariant(master, channel.service); });
    setVariants(next);
  }

  function addThreadPost() { setThread((items) => [...items, { text: "", imageUrl: "", altText: "" }]); }
  function removeThreadPost(index: number) { setThread((items) => items.length <= 1 ? items : items.filter((_, itemIndex) => itemIndex !== index)); }

  async function publish() {
    setPublishing(true);
    setResult([]);
    const messages: string[] = [];
    for (const channelId of selected) {
      const channel = eligible.find((item) => item.id === channelId);
      if (!channel) continue;
      try {
        const isThread = contentMode === "thread" && (channel.service === "twitter" || channel.service === "threads");
        const cleanThread = thread.filter((item) => item.text.trim()).map((item) => ({ text: item.text.trim(), imageUrl: item.imageUrl.trim() || undefined, altText: item.altText.trim() || undefined }));
        const payload = {
          channelId,
          service: channel.service,
          text: isThread ? cleanThread[0]?.text || "" : variants[channelId] || source,
          mode,
          dueAt: mode === "customScheduled" ? new Date(dueAt).toISOString() : undefined,
          imageUrl: isThread ? undefined : imageUrl.trim() || undefined,
          imageAltText: isThread ? undefined : imageAlt.trim() || undefined,
          thread: isThread ? cleanThread : undefined,
        };
        const response = await fetch("/api/buffer/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Buffer rejected the post.");
        messages.push(`${labels[channel.service] || channel.service}: ${mode === "shareNow" ? "published" : mode === "customScheduled" ? "scheduled" : "added to queue"}`);
      } catch (err: unknown) {
        messages.push(`${labels[channel.service] || channel.service}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    setResult(messages);
    setPublishing(false);
  }

  const threadReady = contentMode === "thread" && thread.some((item) => item.text.trim());
  const postReady = contentMode === "post" && source.trim();
  const canPublish = selected.length > 0 && Boolean(threadReady || postReady) && (mode !== "customScheduled" || Boolean(dueAt));

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.kicker}><Send size={13} /> Web3 Pulse Publishing Studio</div>
            <h1 style={styles.h1}>Review → media → Buffer</h1>
            <p style={styles.subtitle}>Approve content, attach media, then send it to your selected Buffer channels. Maximum three publishing targets.</p>
          </div>
          <a href="/" style={styles.back}><ArrowLeft size={14} /> Dashboard</a>
        </header>

        {loading && <Panel><Loader2 className="spin" size={18} /><b>Connecting to Buffer…</b><span>Detecting connected channels and organization limits.</span></Panel>}
        {error && <Panel danger><ShieldCheck size={18} /><div><b>Buffer connection needed</b><p>{error}</p><small>Add <strong>BUFFER_API_KEY</strong> to Vercel Environment Variables and redeploy.</small></div></Panel>}

        {workspace && !loading && <>
          <section style={styles.metrics}>
            <Metric label="Buffer status" value="Connected" />
            <Metric label="Plan signal" value={workspace.plan} />
            <Metric label="Connected channels" value={String(workspace.channels.length)} />
            <Metric label="Selected targets" value={`${selected.length}/3`} />
          </section>

          <Panel>
            <div style={styles.panelHead}><div><h2 style={styles.h2}>1. Choose publishing targets</h2><p style={styles.muted}>Only connected and unlocked channels can be selected.</p></div><span style={styles.note}>{workspace.planSource}</span></div>
            <div style={styles.channels}>{workspace.channels.map((channel) => {
              const usable = supported.includes(channel.service) && !channel.isDisconnected && !channel.isLocked;
              const active = selected.includes(channel.id);
              return <button key={channel.id} disabled={!usable} onClick={() => toggleChannel(channel.id)} style={{ ...styles.channel, ...(active ? styles.channelActive : {}) }}><div style={styles.channelTop}><b>{labels[channel.service] || channel.service}</b>{active ? <Check size={15} /> : null}</div><span>{channel.displayName || channel.name}</span><small>{!usable ? (channel.isLocked ? "Locked" : channel.isDisconnected ? "Disconnected" : "Not enabled") : channel.isQueuePaused ? "Queue paused" : "Ready"}</small></button>;
            })}</div>
          </Panel>

          <Panel>
            <div style={styles.panelHead}><div><h2 style={styles.h2}>2. Prepare content</h2><p style={styles.muted}>Create a platform post or a real X/Threads thread. Each thread post can have its own image and alt text.</p></div><div style={styles.switcher}><button onClick={() => setContentMode("thread")} style={contentMode === "thread" ? styles.switchActive : styles.switch}><Twitter size={13} /> Thread</button><button onClick={() => setContentMode("post")} style={contentMode === "post" ? styles.switchActive : styles.switch}>Post</button></div></div>
            {contentMode === "thread" ? <div>
              {thread.map((item, index) => <div key={index} style={styles.threadItem}><div style={styles.threadHead}><b>Post {index + 1}</b>{thread.length > 1 && <button onClick={() => removeThreadPost(index)} style={styles.iconButton}><X size={14} /></button>}</div><textarea value={item.text} onChange={(event) => updateThread(index, "text", event.target.value)} placeholder={index === 0 ? "Thread hook…" : "Next post…"} style={styles.textarea} /><div style={styles.mediaGrid}><input value={item.imageUrl} onChange={(event) => updateThread(index, "imageUrl", event.target.value)} placeholder="Optional public image URL" style={styles.input} /><input value={item.altText} onChange={(event) => updateThread(index, "altText", event.target.value)} placeholder="Alt text" style={styles.input} /></div>{item.imageUrl && <img src={item.imageUrl} alt={item.altText || "Thread media preview"} style={styles.preview} />}</div>)}
              <button onClick={addThreadPost} style={styles.secondary}>+ Add thread post</button>
            </div> : <>
              <textarea value={source} onChange={(event) => setSource(event.target.value)} placeholder="Paste the master post from Content Studio…" style={styles.textarea} />
              <div style={styles.mediaBox}><b><ImageIcon size={14} /> Attach image</b><span>Use a public image URL so Buffer can retrieve the media.</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…/image.jpg" style={styles.input} /><input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="Alt text (recommended)" style={styles.input} />{imageUrl && <img src={imageUrl} alt={imageAlt || "Post media preview"} style={styles.preview} />}</div>
            </>}
            <div style={styles.actionRow}><span style={styles.note}>{selected.length} target{selected.length === 1 ? "" : "s"} selected</span><button onClick={buildVariants} disabled={contentMode === "thread" ? !thread[0]?.text.trim() : !source.trim()} style={styles.primary}><Sparkles size={13} /> Generate platform variants</button></div>
          </Panel>

          <Panel>
            <div style={styles.panelHead}><div><h2 style={styles.h2}>3. Review platform content</h2><p style={styles.muted}>Edit anything before sending it to Buffer.</p></div></div>
            {eligible.map((channel) => <div key={channel.id} style={{ ...styles.variant, ...(selected.includes(channel.id) ? styles.variantSelected : {}) }}><div style={styles.variantHead}><div><b>{labels[channel.service] || channel.service}</b><span style={styles.badge}>{selected.includes(channel.id) ? "Publishing target" : "Content only"}</span></div>{channel.externalLink && <a href={channel.externalLink} target="_blank" rel="noreferrer" style={styles.accountLink}><Link2 size={12} /> Open account</a>}</div>{contentMode === "thread" && (channel.service === "twitter" || channel.service === "threads") ? <div style={styles.threadNotice}>{thread.filter((item) => item.text.trim()).length}-post thread will be sent, with per-post media.</div> : <textarea value={variants[channel.id] || ""} onChange={(event) => setVariants((current) => ({ ...current, [channel.id]: event.target.value }))} placeholder="Generate platform variants above…" style={styles.textarea} />}</div>)}
            <div style={styles.delivery}><div><b><CalendarClock size={14} /> Delivery</b><small>Choose how Buffer should handle selected targets.</small></div><select value={mode} onChange={(event) => setMode(event.target.value as DeliveryMode)} style={styles.select}><option value="addToQueue">Add to Buffer queue</option><option value="customScheduled">Schedule for a specific time</option><option value="shareNow">Publish now</option></select>{mode === "customScheduled" && <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} style={styles.input} />}<button onClick={publish} disabled={publishing || !canPublish} style={styles.publish}>{publishing ? <><Loader2 size={14} className="spin" /> Sending…</> : <><Send size={14} /> {mode === "shareNow" ? "Publish selected targets" : "Send to Buffer"}</>}</button></div>
            {result.length > 0 && <div style={styles.results}>{result.map((message, index) => <div key={index}><Check size={14} /> {message}</div>)}</div>}
          </Panel>
          <div style={styles.footer}><ShieldCheck size={14} /> Human approval remains required. Web3 Pulse never silently publishes generated content.</div>
        </>}
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}"}</style>
    </main>
  );
}

function Panel({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) { return <section style={{ ...styles.panel, ...(danger ? styles.danger : {}) }}>{children}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div style={styles.metric}><small>{label}</small><b>{value}</b></div>; }

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f5f8fc", color: "#162033", fontFamily: "Inter,system-ui,sans-serif" }, shell: { maxWidth: 1180, margin: "0 auto", padding: "34px 24px 90px" }, header: { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-end", marginBottom: 22 }, kicker: { display: "inline-flex", gap: 7, alignItems: "center", color: "#087f91", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".14em" }, h1: { margin: "9px 0 6px", fontSize: 34, letterSpacing: "-.04em" }, h2: { fontSize: 17, margin: 0 }, subtitle: { margin: 0, color: "#68778c", fontSize: 13, maxWidth: 720, lineHeight: 1.6 }, back: { display: "inline-flex", gap: 7, alignItems: "center", textDecoration: "none", color: "#405069", background: "#fff", border: "1px solid #dce4ee", borderRadius: 10, padding: "10px 13px", fontSize: 11, fontWeight: 800 }, metrics: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }, metric: { background: "#fff", border: "1px solid #dce4ee", borderRadius: 14, padding: 14 }, panel: { background: "#fff", border: "1px solid #dce4ee", borderRadius: 18, padding: 20, marginBottom: 14, boxShadow: "0 8px 30px rgba(31,51,73,.045)" }, danger: { display: "flex", gap: 12, alignItems: "flex-start", borderColor: "#fecaca", background: "#fffafa", color: "#991b1b" }, panelHead: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start" }, muted: { color: "#718096", fontSize: 11 }, note: { color: "#7a8798", fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }, channels: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9, marginTop: 15 }, channel: { border: "1px solid #dce4ee", background: "#fbfcfe", borderRadius: 13, padding: 13, textAlign: "left", minWidth: 0, color: "#152238" }, channelActive: { borderColor: "#0ea5b7", background: "#ecfeff", boxShadow: "0 0 0 2px rgba(14,165,183,.08)" }, channelTop: { display: "flex", justifyContent: "space-between" }, switcher: { display: "flex", gap: 3, border: "1px solid #dce4ee", borderRadius: 9, padding: 2, background: "#f7f9fc" }, switch: { border: 0, background: "transparent", borderRadius: 7, padding: "7px 9px", fontSize: 10, fontWeight: 800, color: "#718096" }, switchActive: { border: 0, background: "#fff", borderRadius: 7, padding: "7px 9px", fontSize: 10, fontWeight: 800, color: "#087f91", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }, threadItem: { border: "1px solid #dce4ee", background: "#fafcff", borderRadius: 14, padding: 12, marginTop: 12 }, threadHead: { display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#087f91", fontSize: 10 }, iconButton: { border: 0, background: "transparent", color: "#7a8798" }, textarea: { width: "100%", minHeight: 105, border: "1px solid #dce4ee", background: "#fff", borderRadius: 10, padding: 11, resize: "vertical", outline: "none", fontSize: 12, lineHeight: 1.55, color: "#162033", boxSizing: "border-box" }, mediaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }, input: { width: "100%", boxSizing: "border-box", border: "1px solid #dce4ee", background: "#fff", borderRadius: 9, padding: 10, fontSize: 11, color: "#162033" }, preview: { display: "block", maxWidth: 280, maxHeight: 180, objectFit: "cover", borderRadius: 10, marginTop: 9, border: "1px solid #dce4ee" }, secondary: { marginTop: 10, border: "1px solid #dce4ee", background: "#fff", color: "#405069", borderRadius: 9, padding: "9px 12px", fontSize: 10, fontWeight: 800 }, mediaBox: { display: "grid", gap: 8, marginTop: 12, padding: 13, border: "1px dashed #cbd6e2", borderRadius: 12 }, actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 13 }, primary: { border: 0, borderRadius: 9, padding: "10px 14px", background: "#0f9fb1", color: "#fff", fontSize: 11, fontWeight: 800 }, variant: { border: "1px solid #e1e7ef", borderRadius: 13, padding: 12, marginTop: 10, background: "#fafbfc" }, variantSelected: { borderColor: "#0ea5b7", background: "#f7feff" }, variantHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, badge: { marginLeft: 8, color: "#087f91", fontSize: 9, fontWeight: 800 }, accountLink: { display: "inline-flex", gap: 5, alignItems: "center", color: "#536277", fontSize: 10, textDecoration: "none" }, threadNotice: { padding: 12, borderRadius: 10, background: "#ecfeff", color: "#087f91", fontSize: 11 }, delivery: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center", marginTop: 15, paddingTop: 15, borderTop: "1px solid #e5eaf0" }, select: { border: "1px solid #dce4ee", borderRadius: 9, background: "#fff", padding: "9px 10px", fontSize: 11, color: "#162033" }, publish: { border: 0, borderRadius: 9, padding: "10px 14px", background: "#0f9fb1", color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }, results: { marginTop: 12, padding: 12, borderRadius: 10, background: "#f0fdf4", color: "#166534", fontSize: 11 }, footer: { display: "flex", gap: 7, alignItems: "center", justifyContent: "center", color: "#718096", fontSize: 10, marginTop: 18 },
};