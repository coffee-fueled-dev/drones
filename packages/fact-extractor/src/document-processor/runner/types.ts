/** Configuration for the document processing runner */
export interface RunnerConfig {
  chunkSizeThreshold: number;
  enableGraphiti: boolean;
  extractionTimeoutMs: number;
  resumeFromPosition?: number;
  description?: string;
}

/** Result of processing a document */
export interface ProcessingResult {
  filename: string;
  chunksProcessed: number;
  contextItems: number;
  chunksPath: string;
  metadataPath: string;
  outputDir: string;
}

/** Information about processing progress */
export interface ProcessingStatus {
  currentChunk: number;
  currentPosition: number;
  chunkSize: number;
  totalProcessed: number;
}
