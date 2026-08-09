"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function PublishNav() {
  const pathname = usePathname();
  if (pathname === "/publish") return null;

  return (
    <Link
      href="/publish"
      aria-label="Open Buffer publishing"
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 100,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderRadius: 999,
        background: "#0f9fb1",
        color: "#fff",
        textDecoration: "none",
        fontSize: 12,
        fontWeight: 800,
        boxShadow: "0 10px 28px rgba(15,159,177,.28)",
      }}
    >
      <Send size={15} />
      Publish
    </Link>
  );
}
