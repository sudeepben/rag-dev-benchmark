export interface PgvectorStats {
  chunks: number;
  docChunks: number;
  items: number;
  documents: number;
  dimension: number;
  metric: string;
}

export interface PgvectorRecord {
  id: string;
  refId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PgvectorListResponse {
  records: PgvectorRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
