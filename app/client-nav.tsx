"use client";

import Link from "next/link";

export default function ClientNav() {
  return (
    <Link
      href="/client-mode"
      aria-label="Open Client Mode"
      style={{
        position: "fixed",
        right: 20,
        bottom: 76,
        zIndex: 9999,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 15px",
        borderRadius: 999,
        background: "#ffffff",
        color: "#172033",
        border: "1px solid #dbe4ee",
        boxShadow: "0 8px 24px rgba(15,23,42,.12)",
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      <span style={{ fontSize: 14 }}>◉</span>
      Client Mode
    </Link>
  );
}
