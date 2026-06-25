import type { Metadata } from "next";
import Link from "next/link";
import ProgressBadge from "./components/ProgressBadge";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Agent",
  description: "AI study assistant dashboard and chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Study Agent</p>
              <h1 className="text-lg font-semibold text-slate-100">Study Agent</h1>
            </div>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm font-medium text-slate-300 transition hover:text-white">
                Chat
              </Link>
              <ProgressBadge />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
