import type { Metadata } from "next";
import "./globals.css";
import "./light-theme.css";
import PublishNav from "./publish-nav";
import ClientNav from "./client-nav";

export const metadata: Metadata = {
  title: "Web3 Pulse AI",
  description: "Web3 PR, research and content intelligence workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ClientNav/><PublishNav/></body></html>;
}
