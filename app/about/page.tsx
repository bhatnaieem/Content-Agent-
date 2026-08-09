"use client";

import { ArrowLeft, CheckCircle2, FileSearch, PenLine, ShieldCheck, Sparkles, Target, TrendingUp, Users } from "lucide-react";

const capabilities = [
  { icon: FileSearch, title: "Research", text: "Find recent Web3 stories, conversations and developments worth paying attention to." },
  { icon: TrendingUp, title: "Narrative Radar", text: "Surface themes gaining momentum and rank them by editorial signal." },
  { icon: Target, title: "Prioritisation", text: "Score opportunities so the strongest stories rise to the top of the briefing." },
  { icon: PenLine, title: "Content Studio", text: "Turn selected stories into threads, posts, replies, quotes, polls and creative briefs." },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-shell">
        <a href="/" className="about-back"><ArrowLeft size={15} /> Back to CryptoPulse</a>

        <section className="about-hero">
          <div className="about-kicker"><Sparkles size={14} /> ABOUT CRYPTOPULSE AI</div>
          <h1>Web3 intelligence for teams that need to move fast.</h1>
          <p>CryptoPulse is a research and content intelligence workspace built to help Web3 PR and social teams discover what matters, understand why it matters, and turn that signal into publication-ready content.</p>
          <div className="about-note"><ShieldCheck size={16} /><span><strong>Human publishing stays in control.</strong> CryptoPulse prepares and organises the work; your team reviews, copies and publishes it manually.</span></div>
        </section>

        <section className="about-section">
          <div className="about-section-heading"><span>01</span><div><h2>What CryptoPulse does</h2><p>One workflow from ecosystem research to editorial output.</p></div></div>
          <div className="about-grid">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article className="about-card" key={title}>
                <div className="about-icon"><Icon size={18} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section about-two-col">
          <div>
            <div className="about-section-heading"><span>02</span><div><h2>Built for editorial judgment</h2><p>AI accelerates the workflow without replacing the person responsible for the message.</p></div></div>
            <ul className="about-list">
              <li><CheckCircle2 size={16} /> Focus on recent, relevant signals rather than generic crypto noise.</li>
              <li><CheckCircle2 size={16} /> Keep source evidence and publication dates visible whenever research provides them.</li>
              <li><CheckCircle2 size={16} /> Edit every generated asset before it goes public.</li>
              <li><CheckCircle2 size={16} /> Keep publishing deliberately manual instead of automating account actions.</li>
            </ul>
          </div>
          <div className="about-principles"><div className="about-principle"><Users size={17}/><div><b>For PR & social teams</b><span>Research, prioritisation and content production in one workspace.</span></div></div><div className="about-principle"><Target size={17}/><div><b>Signal over volume</b><span>The goal is not more stories. It is better opportunities.</span></div></div></div>
        </section>

        <footer className="about-footer">CryptoPulse AI <span>•</span> Web3 intelligence workspace</footer>
      </div>

      <style jsx global>{`
        *{box-sizing:border-box}.about-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:30px 18px 50px}.about-shell{max-width:1080px;margin:auto}.about-back{display:inline-flex;align-items:center;gap:7px;color:#64748b;text-decoration:none;font-size:12px;font-weight:700;margin:4px 0 38px}.about-back:hover{color:#0f766e}.about-hero{background:#172033;color:white;border-radius:26px;padding:clamp(30px,6vw,62px);box-shadow:0 20px 55px rgba(15,23,42,.12)}.about-kicker{display:flex;align-items:center;gap:7px;color:#5eead4;font-size:10px;font-weight:900;letter-spacing:.13em}.about-hero h1{max-width:790px;font-size:clamp(35px,6vw,62px);line-height:1.02;letter-spacing:-.055em;margin:15px 0 18px}.about-hero>p{max-width:720px;color:#cbd5e1;font-size:15px;line-height:1.7;margin:0}.about-note{max-width:720px;margin-top:27px;padding:13px 15px;border:1px solid rgba(255,255,255,.12);border-radius:13px;display:flex;gap:10px;color:#dbeafe;font-size:11px;line-height:1.55}.about-note svg{color:#5eead4;flex:none;margin-top:1px}.about-section{padding:58px 5px 0}.about-section-heading{display:flex;gap:16px;align-items:flex-start;margin-bottom:22px}.about-section-heading>span{font-size:10px;color:#0f766e;font-weight:900;letter-spacing:.1em;padding-top:7px}.about-section-heading h2{font-size:25px;letter-spacing:-.035em;margin:0 0 5px}.about-section-heading p{margin:0;color:#64748b;font-size:12px;line-height:1.55}.about-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.about-card{background:white;border:1px solid #e2e8f0;border-radius:18px;padding:19px;box-shadow:0 8px 28px rgba(15,23,42,.04)}.about-icon{width:36px;height:36px;border-radius:11px;background:#ecfeff;color:#0f766e;display:grid;place-items:center;margin-bottom:15px}.about-card h3{font-size:14px;margin:0 0 7px}.about-card p{font-size:11px;color:#64748b;line-height:1.6;margin:0}.about-two-col{display:grid;grid-template-columns:1.25fr .75fr;gap:40px}.about-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}.about-list li{display:flex;align-items:flex-start;gap:9px;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:11px;color:#475569;line-height:1.5}.about-list svg{color:#0f766e;flex:none;margin-top:1px}.about-principles{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:8px}.about-principle{display:flex;gap:12px;padding:17px 12px;border-bottom:1px solid #eef2f7}.about-principle:last-child{border-bottom:0}.about-principle>svg{color:#0f766e;flex:none;margin-top:2px}.about-principle b,.about-principle span{display:block}.about-principle b{font-size:11px;margin-bottom:4px}.about-principle span{font-size:10px;color:#64748b;line-height:1.5}.about-footer{text-align:center;color:#94a3b8;font-size:10px;padding-top:58px}.about-footer span{margin:0 6px}@media(max-width:850px){.about-grid{grid-template-columns:1fr 1fr}.about-two-col{grid-template-columns:1fr}}@media(max-width:520px){.about-page{padding:20px 14px 35px}.about-back{margin-bottom:22px}.about-grid{grid-template-columns:1fr}.about-hero{border-radius:20px;padding:28px 23px}.about-hero h1{font-size:37px}.about-section{padding-top:42px}}
      `}</style>
    </main>
  );
}
