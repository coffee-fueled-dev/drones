import type { Fact } from "../agents/fact-extractor";

/** Core domain model for document processing */
export interface ProcessingState {
  chunkCounter: number;
  characterPosition: number;
  estimatedChunks: number;
  lastFiveGlobalContext: string[];
  fileSize?: number;
}

export interface ProcessingConfig {
  chunkSizeThreshold: number;
  enableGraphiti: boolean;
  resumeFromPosition: number;
  existingGlobalContext: string[];
  extractionTimeoutMs: number;
}

export interface ProcessingPaths {
  outputDir: string;
  factsPath: string;
  globalContextPath: string;
  metadataPath: string;
}

export interface DocumentMetadata {
  filename: string;
  filepath: string;
  processedAt: string;
  lastUpdated: string;
  chunkSizeThreshold: number;
  currentContext: string[];
  totalChunks: number;
  estimatedChunks: number;
  characterPosition: number;
  factsFile: string;
  globalContextFile: string;
  status: "processing" | "completed";
  lastChunkProcessedAt: string;
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
