"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CsvImport } from "./_components/csv-import";
import { ItemsTable } from "./_components/items-table";
import { ItemDialog } from "./_components/item-dialog";
import { ResetDialog } from "./_components/reset-dialog";

export default function InventoryPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-[1400px] py-8 px-6">
      <div className="flex items-end justify-between mb-8 animate-fade-in-up">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Inventory</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your product catalog and vector embeddings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setResetOpen(true)}
          >
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Hard Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </Button>
          <CsvImport onImported={refresh} />
        </div>
      </div>
      <div className="animate-fade-in-up delay-1">
        <ItemsTable refreshKey={refreshKey} />
      </div>

      <ItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        item={null}
        onSaved={refresh}
      />
      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={refresh}
      />
    </div>
  );
}
