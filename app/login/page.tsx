"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password}) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Login failed");
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.assign(next.startsWith("/") ? next : "/");
    } catch(e) { setError(e instanceof Error ? e.message : "Invalid password"); setPassword(""); }
    finally { setLoading(false); }
  }

  return <main className={styles.page}><div className={`${styles.glowA} ${styles.glowA}`}/><div className={styles.glowB}/><section className={styles.card}>
    <div className={styles.logo}><Sparkles size={22}/></div><div className={styles.kicker}><ShieldCheck size={13}/> Private workspace</div>
    <h1 className={styles.title}>Welcome back.</h1><p className={styles.sub}>Web3 Pulse AI is protected. Enter your workspace password to continue.</p>
    <form onSubmit={submit}><label className={styles.label} htmlFor="password">Workspace password</label><div className={styles.inputWrap}><LockKeyhole size={16}/><input className={styles.input} id="password" type="password" autoComplete="current-password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required /></div>
    {error&&<div className={styles.error}>{error}</div>}<button className={styles.button} type="submit" disabled={loading}>{loading?"Checking…":"Enter Web3 Pulse"}<ArrowRight size={16}/></button></form>
    <div className={styles.note}><ShieldCheck size={13}/> Session is encrypted and expires automatically after 7 days.</div>
  </section></main>;
}
