import { DocumentUpload } from "./_components/document-upload";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-3xl py-8 px-6">
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload and test raw documents for RAG retrieval — isolated from
          inventory
        </p>
      </div>
      <div className="animate-fade-in-up delay-1">
        <DocumentUpload />
      </div>
    </div>
  );
}
