'use client';
import { useState } from 'react';

export default function Home() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState('');
  async function runNow() {
    setRunning(true); setResult('');
    try {
      const secret = window.prompt('Enter CRON_SECRET to run now:');
      if (!secret) return;
      const res = await fetch('/api/cron', { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json();
      setResult(data.post ? data.post : data.error || data.reason || 'Done');
    } catch (e) { setResult(e instanceof Error ? e.message : 'Failed'); }
    finally { setRunning(false); }
  }
  return <main style={{maxWidth:760,margin:'60px auto',padding:24,fontFamily:'system-ui'}}>
    <h1>LinkedIn Weekend Agent</h1>
    <p>Every Sunday, Gemini writes a useful personal-brand post, an image model creates the visual, and the agent publishes both to your LinkedIn profile.</p>
    <div style={{display:'flex',gap:12,marginTop:24}}>
      <a href="/api/auth/linkedin" style={{padding:'12px 18px',background:'#0a66c2',color:'#fff',borderRadius:8,textDecoration:'none'}}>Connect LinkedIn</a>
      <button onClick={runNow} disabled={running} style={{padding:'12px 18px',borderRadius:8,border:'1px solid #ccc'}}>{running?'Publishing…':'Run now'}</button>
    </div>
    {result && <pre style={{whiteSpace:'pre-wrap',marginTop:24,padding:16,background:'#f5f5f5',borderRadius:8}}>{result}</pre>}
    <p style={{marginTop:36,fontSize:14,color:'#666'}}>Configure topics and tone with LINKEDIN_TOPICS, LINKEDIN_TONE and LINKEDIN_PROFILE_CONTEXT in Vercel environment variables.</p>
  </main>;
}
