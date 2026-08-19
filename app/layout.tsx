import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceCanvas",
  description: "Turn photos into transparent drawing guides and trace them with your phone camera.",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}