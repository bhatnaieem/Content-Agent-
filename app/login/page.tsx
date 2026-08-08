"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Login failed");
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.assign(next.startsWith("/") ? next : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid password");
      setPassword("");
    } finally { setLoading(false); }
  }

  return <main className="cp-login"><div className="cp-login-glow cp-login-glow-a"/><div className="cp-login-glow cp-login-glow-b"/>
    <section className="cp-login-card">
      <div className="cp-login-logo"><Sparkles size={22}/></div>
      <div className="cp-login-kicker"><ShieldCheck size={13}/> Private workspace</div>
      <h1>Welcome back.</h1>
      <p className="cp-login-sub">CryptoPulse AI is protected. Enter your workspace password to continue.</p>
      <form onSubmit={submit}>
        <label className="cp-login-label" htmlFor="password">Workspace password</label>
        <div className="cp-login-input-wrap"><LockKeyhole size={16}/><input id="password" type="password" autoComplete="current-password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required /></div>
        {error && <div className="cp-login-error">{error}</div>}
        <button className="cp-login-button" type="submit" disabled={loading}>{loading?"Checking…":"Enter CryptoPulse"}<ArrowRight size={16}/></button>
      </form>
      <div className="cp-login-note"><ShieldCheck size={13}/> Session is encrypted and expires automatically after 7 days.</div>
    </section>
  </main>;
}
