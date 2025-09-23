import type { Fact } from "../agents/fact-extractor";

/** Core domain model for document processing */
export interface ProcessingState {
  chunkId: string; // UUID
  cursorPosition: number;
  context: {
    current: string[];
    lastFiveGlobal: string[];
  };
  chunkSize: number;
  tsStart: number;
  tsEnd: number;
}

export interface Chunk extends ProcessingState {
  hashes: {
    extraction: string; // Compressed Extraction response
    processMetadata: string; // Compressed ProcessMetadata
  };
}

export interface ProcessingConfig {
  chunkSizeThreshold: number;
  resumeFromPosition: number;
  existingGlobalContext: string[];
  extractionTimeoutMs: number;
}

export interface ProcessingPaths {
  outputDir: string;
  metadataPath: string;
  chunksPath: string;
}

export interface ProcessMetadata {
  processId: string; // UUID
  filename: string;
  filepath: string;
  description?: string;
  processedAt: string;
  lastUpdated: string;
  chunkSizeThreshold: number;
  fileSize?: number;
  status: "processing" | "completed";
  completedAt?: string;
}

export interface ChunkProcessingResult {
  newFacts: Fact[];
  newGlobalContext: string[];
  updatedState: ProcessingState;
}

export interface ProcessingProgress {
  totalFacts: number;
  totalGlobalContext: number;
  progressInfo: string;
}

export interface ResumeInfo {
  position: number;
  existingGlobalContext: string[];
}
