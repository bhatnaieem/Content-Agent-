import type { Metadata } from "next";
import "./globals.css";
import "./light-theme.css";

export const metadata: Metadata = {
  title: "CryptoPulse AI Dashboard",
  description: "Web3 PR & Content Intelligence Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
