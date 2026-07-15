"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/inventory", label: "Inventory" },
  { href: "/documents", label: "Documents" },
  { href: "/search", label: "Search" },
  { href: "/experiment", label: "Experiment" },
  { href: "/pgvector", label: "PGvector" },
  { href: "/pinecone", label: "Pinecone" },
  { href: "/settings", label: "Settings" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0.5 px-6 pt-3">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "group relative px-4 py-2 text-sm font-medium tracking-wide transition-colors duration-200",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {tab.label}
            {/* Active indicator */}
            <span
              className={cn(
                "absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-primary transition-all duration-300",
                isActive
                  ? "opacity-100 scale-x-100"
                  : "opacity-0 scale-x-0"
              )}
            />
            {/* Hover indicator */}
            {!isActive && (
              <span className="absolute inset-x-2 -bottom-px h-px bg-foreground/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
