import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavTabs } from "./_components/nav-tabs";
import { ThemeToggle } from "./_components/theme-toggle";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAG System",
  description: "Document ingestion and retrieval-augmented generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}})();`,
          }}
        />
      </head>
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased h-dvh flex flex-col overflow-hidden`}
      >
        <header className="relative shrink-0">
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <div className="flex items-center gap-2.5">
              <span className="text-primary text-base leading-none">◆</span>
              <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-foreground/80">
                RAG System
              </h1>
            </div>
            <ThemeToggle />
          </div>
          <NavTabs />
          <div className="h-px bg-gradient-to-r from-primary/50 via-primary/15 to-transparent" />
        </header>
        <main className="flex-1 overflow-y-auto bg-dot-grid">
          {children}
        </main>
      </body>
    </html>
  );
}
