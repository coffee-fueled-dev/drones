import type { FactExtractionAgent } from "../agents/fact-extractor";
import type {
  ProcessingState,
  ChunkProcessingResult,
  ProcessingProgress,
  ProcessingConfig,
  Chunk,
  ProcessMetadata,
} from "./types";
import { Encoder } from "../encoder";

/** Pure functions for processing logic */

export function createInitialState(config: ProcessingConfig): ProcessingState {
  // Ensure existingGlobalContext is always an array
  const existingContext = Array.isArray(config?.existingGlobalContext)
    ? config.existingGlobalContext
    : [];

  return {
    chunkId: Bun.randomUUIDv7(),
    cursorPosition: config.resumeFromPosition,
    context: {
      current: [],
      lastFiveGlobal: [...existingContext],
    },
    chunkSize: 0,
    tsStart: Date.now(),
    tsEnd: 0,
  };
}

export function updateStateForChunk(
  state: ProcessingState,
  chunkStartPosition: number | undefined,
  paraLength: number
): ProcessingState {
  const newCursorPosition =
    chunkStartPosition !== undefined
      ? chunkStartPosition
      : state.cursorPosition + paraLength;

  return {
    ...state,
    chunkId: Bun.randomUUIDv7(),
    cursorPosition: newCursorPosition,
    chunkSize: paraLength,
    tsStart: Date.now(),
    tsEnd: 0,
  };
}

export function detectNewGlobalContext(
  currentGlobalContext: string[],
  lastKnownContext: string[]
): string[] {
  return currentGlobalContext.filter((entry) => {
    return !lastKnownContext.includes(entry);
  });
}

export function updateContextTracking(
  state: ProcessingState,
  currentContext: string[],
  globalContext: string[]
): ProcessingState {
  return {
    ...state,
    context: {
      current: [...currentContext],
      lastFiveGlobal: [...globalContext.slice(-5)],
    },
  };
}

export function processChunkData(
  factAgent: FactExtractionAgent,
  state: ProcessingState
): ChunkProcessingResult {
  const currentGlobalContext = factAgent.globalContext;
  const currentContext = factAgent.currentContext;
  const newGlobalContext = detectNewGlobalContext(
    currentGlobalContext,
    state.context.lastFiveGlobal
  );

  const updatedState = updateContextTracking(
    state,
    currentContext,
    currentGlobalContext
  );
  const newFacts = factAgent.flushFacts();

  return {
    newFacts,
    newGlobalContext,
    updatedState,
  };
}

export function createProcessMetadata(
  processId: string,
  file: Bun.BunFile,
  config: ProcessingConfig,
  fileSize: number,
  status: "processing" | "completed" = "processing",
  description: string = ""
): ProcessMetadata {
  const filename = file.name
    ? file.name.split("/").pop() || "unknown.txt"
    : "unknown.txt";
  const now = new Date().toISOString();

  const metadata: ProcessMetadata = {
    processId,
    filename,
    filepath: file.name || "",
    description,
    processedAt: now,
    lastUpdated: now,
    chunkSizeThreshold: config.chunkSizeThreshold,
    fileSize,
    status,
  };

  if (status === "completed") {
    metadata.completedAt = now;
  }

  return metadata;
}

export function calculateProgress(
  state: ProcessingState,
  totalFacts: number,
  totalGlobalContext: number,
  fileSize?: number
): ProcessingProgress {
  let progressInfo = "";

  if (fileSize && fileSize > 0) {
    const progressPercent = Math.min(
      100,
      (state.cursorPosition / fileSize) * 100
    );
    progressInfo = ` (${progressPercent.toFixed(1)}% - ${state.cursorPosition.toLocaleString()}/${fileSize.toLocaleString()} chars)`;
  }

  return {
    totalFacts,
    totalGlobalContext,
    progressInfo,
  };
}

export function formatProgressLog(
  state: ProcessingState,
  progress: ProcessingProgress,
  newFactsCount: number,
  newGlobalContextCount: number
): string {
  return `[${new Date().toLocaleTimeString()}] Chunk ${state.chunkId}${progress.progressInfo} @ pos ${state.cursorPosition}: ${progress.totalFacts} total facts (+${newFactsCount} new), ${progress.totalGlobalContext} context items (+${newGlobalContextCount} new)`;
}

export function shouldLogNewGlobalContext(
  newGlobalContextCount: number
): boolean {
  return newGlobalContextCount > 0;
}

export function formatNewGlobalContextLog(
  newGlobalContextCount: number,
  totalGlobalContextCount: number
): string {
  return `[DocumentProcessor] 📝 Detected ${newGlobalContextCount} new context entries out of ${totalGlobalContextCount} total`;
}

export function createChunk(
  state: ProcessingState,
  extraction: any,
  processMetadata: ProcessMetadata
): Chunk {
  return {
    ...state,
    tsEnd: Date.now(),
    hashes: {
      extraction: Encoder.encode(extraction),
      processMetadata: Encoder.encode(processMetadata),
    },
  };
}
