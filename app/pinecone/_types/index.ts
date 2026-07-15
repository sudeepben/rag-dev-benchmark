export interface PineconeIndexInfo {
  name: string;
  dimension: number;
  metric: string;
  host: string;
  status: { ready: boolean; state: string };
  spec: unknown;
}

export interface PineconeStatsResponse {
  stats: {
    vectorCount: number;
    dimension?: number;
    indexFullness?: number;
    namespaces?: Record<string, { recordCount: number }>;
  };
  info: PineconeIndexInfo;
}

export interface VectorRecord {
  id: string;
  metadata: Record<string, unknown>;
  hasValues: boolean;
  dimension: number;
}

export interface ListResponse {
  ids: string[];
  nextToken?: string;
}

export interface FetchResponse {
  records: VectorRecord[];
}
