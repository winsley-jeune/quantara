export type ScanStatus = 'running' | 'completed' | 'failed';

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt: string | null;
  feedUrls: string[];
  productCount: number;
  errorMessage: string | null;
}
