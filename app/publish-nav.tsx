"use client";

import Link from "next/link";
import { Info, Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function PublishNav() {
  const pathname = usePathname();
  if (pathname === "/publish" || pathname === "/about") return null;
  return <div className="publish-nav">
    <Link href="/about" aria-label="About Web3 Pulse" className="publish-nav-about"><Info size={15}/>About</Link>
    <Link href="/publish" aria-label="Open Web3 Pulse Publishing Studio" className="publish-nav-studio"><Send size={15}/>Publishing Studio</Link>
  </div>;
}
