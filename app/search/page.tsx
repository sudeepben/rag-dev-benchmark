import { QueryPanel } from "./_components/query-panel";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl py-8 px-6">
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-xl font-semibold tracking-tight">Search</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Query your inventory with natural language — powered by vector search
        </p>
      </div>
      <div className="animate-fade-in-up delay-1">
        <QueryPanel />
      </div>
    </div>
  );
}
