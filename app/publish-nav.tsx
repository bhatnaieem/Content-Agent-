"use client";

import Link from "next/link";
import { Info, Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function PublishNav() {
  const pathname = usePathname();
  if (pathname === "/publish" || pathname === "/about") return null;
  return <div style={{position:"fixed",right:24,bottom:24,zIndex:100,display:"flex",alignItems:"center",gap:8}}>
    <Link href="/about" aria-label="About Web3 Pulse" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"11px 14px",borderRadius:999,background:"rgba(255,255,255,.92)",color:"#17324d",textDecoration:"none",fontSize:12,fontWeight:800,border:"1px solid rgba(23,50,77,.12)",boxShadow:"0 10px 28px rgba(23,50,77,.10)"}}><Info size={15}/>About</Link>
    <Link href="/publish" aria-label="Open Web3 Pulse Publishing Studio" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 16px",borderRadius:999,background:"#0f9fb1",color:"#fff",textDecoration:"none",fontSize:12,fontWeight:800,boxShadow:"0 10px 28px rgba(15,159,177,.28)"}}><Send size={15}/>Publishing Studio</Link>
  </div>;
}
