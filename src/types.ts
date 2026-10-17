export interface Segment {
  id: number;
  start: number;
  end: number;
  current: number;
  percent: number;
  active: boolean;
  completed: boolean;
}

export interface DownloadItem {
  id: string;
  url: string;
  fileName: string;
  savePath: string;
  filePath: string;
  category: 'General' | 'Compressed' | 'Documents' | 'Music' | 'Programs' | 'Video';
  status: 'idle' | 'probing' | 'downloading' | 'paused' | 'completed' | 'queued' | 'error';
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
  speed: number; // bytes/sec
  peakSpeed?: number;
  avgSpeed?: number;
  speedSamples?: number[];
  eta: number; // seconds
  resumable: boolean;
  maxConnections?: number;
  throttledReason?: string;
  error?: string;
  segments?: Segment[];
  createdAt: string;
}


export type CategoryFilter = 'All' | 'Compressed' | 'Documents' | 'Music' | 'Programs' | 'Video';
export type StatusFilter = 'All' | 'Active' | 'Paused' | 'Completed' | 'Queued' | 'Grabber';

