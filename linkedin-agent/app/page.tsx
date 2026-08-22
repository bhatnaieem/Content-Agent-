export default function Home() {
  return <main style={{maxWidth:720,margin:'80px auto',padding:24,fontFamily:'system-ui'}}>
    <h1>LinkedIn Weekend Agent</h1>
    <p>This agent automatically creates and publishes one LinkedIn post every weekend.</p>
    <h2 style={{marginTop:32}}>Content focus</h2>
    <p>Marketing, entrepreneurship and business in India.</p>
    <a href="/api/auth/linkedin" style={{display:'inline-block',marginTop:20,padding:'12px 18px',background:'#0a66c2',color:'#fff',borderRadius:8,textDecoration:'none'}}>Connect LinkedIn</a>
    <p style={{marginTop:32,fontSize:14,color:'#666'}}>After you connect LinkedIn once, weekly publishing runs automatically. No weekly approval is required.</p>
  </main>;
}
