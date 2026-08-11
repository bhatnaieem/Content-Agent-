import type { Metadata } from "next";
import "./globals.css";
import "./light-theme.css";
import "./ui-polish.css";
import PublishNav from "./publish-nav";

export const metadata: Metadata = {
  title: "Web3 Pulse AI",
  description: "Web3 PR, research and content intelligence workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PublishNav /></body></html>;
}
