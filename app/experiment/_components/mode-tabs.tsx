"use client";

import type { ExperimentMode } from "../_types";
import { Button } from "@/components/ui/button";

interface ModeTabsProps {
  mode: ExperimentMode;
  onChange: (mode: ExperimentMode) => void;
}

const MODES: {
  value: ExperimentMode;
  label: string;
  description: string;
}[] = [
  {
    value: "raw",
    label: "Raw",
    description: "Direct vector search",
  },
  {
    value: "context-engine",
    label: "Context Engine",
    description: "Smart routing \u2014 decides if RAG is needed",
  },
  {
    value: "knowledge-augmented",
    label: "Knowledge Augmented",
    description: "Model knowledge \u2192 embed \u2192 search \u2192 ground",
  },
];

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/30 p-1">
      {MODES.map((m) => (
        <Button
          key={m.value}
          variant={mode === m.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(m.value)}
          className={
            mode === m.value
              ? "glow-amber-sm text-xs h-8"
              : "text-xs h-8 border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }
          title={m.description}
        >
          <span>{m.label}</span>
          <span className="ml-1.5 hidden lg:inline text-[10px] opacity-60 font-normal">
            {m.description}
          </span>
        </Button>
      ))}
    </div>
  );
}
