import type { Fact, FactExtractionAgent } from "../agents/fact-extractor";
import type {
  ProcessingState,
  ChunkProcessingResult,
  DocumentMetadata,
  ProcessingProgress,
  ProcessingConfig,
  ProcessingPaths,
} from "./types";

/** Pure functions for processing logic */

export function createInitialState(config: ProcessingConfig): ProcessingState {
  return {
    chunkCounter: 0,
    characterPosition: config.resumeFromPosition,
    estimatedChunks: 0,
    lastFiveGlobalContext: [...config.existingGlobalContext],
  };
}

export function updateStateForChunk(
  state: ProcessingState,
  chunkStartPosition: number | undefined,
  paraLength: number
): ProcessingState {
  const newChunkCounter = state.chunkCounter + 1;
  const newCharacterPosition =
    chunkStartPosition !== undefined
      ? chunkStartPosition
      : state.characterPosition + paraLength;

  return {
    ...state,
    chunkCounter: newChunkCounter,
    characterPosition: newCharacterPosition,
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

export function updateGlobalContextTracking(
  state: ProcessingState,
  currentGlobalContext: string[]
): ProcessingState {
  return {
    ...state,
    lastFiveGlobalContext: [...currentGlobalContext.slice(-5)],
  };
}

export function processChunkData(
  factAgent: FactExtractionAgent,
  state: ProcessingState
): ChunkProcessingResult {
  const currentGlobalContext = factAgent.globalContext;
  const newGlobalContext = detectNewGlobalContext(
    currentGlobalContext,
    state.lastFiveGlobalContext
  );

  const updatedState = updateGlobalContextTracking(state, currentGlobalContext);
  const newFacts = factAgent.flushFacts();

  return {
    newFacts,
    newGlobalContext,
    updatedState,
  };
}

export function createDocumentMetadata(
  file: Bun.BunFile,
  config: ProcessingConfig,
  state: ProcessingState,
  currentContext: string[],
  status: "processing" | "completed" = "processing"
): DocumentMetadata {
  const filename = file.name
    ? file.name.split("/").pop() || "unknown.txt"
    : "unknown.txt";
  const now = new Date().toISOString();

  const metadata: DocumentMetadata = {
    filename,
    filepath: file.name || "",
    processedAt: now,
    lastUpdated: now,
    chunkSizeThreshold: config.chunkSizeThreshold,
    currentContext,
    totalChunks: state.chunkCounter,
    estimatedChunks: state.estimatedChunks,
    characterPosition: state.characterPosition,
    factsFile: "facts.jsonl",
    globalContextFile: "global_context.jsonl",
    status,
    lastChunkProcessedAt: now,
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
  newFactsCount: number,
  newGlobalContextCount: number,
  fileSize?: number
): ProcessingProgress {
  let progressInfo = "";

  if (fileSize && fileSize > 0) {
    const progressPercent = Math.min(
      100,
      (state.characterPosition / fileSize) * 100
    );
    progressInfo = ` (${progressPercent.toFixed(1)}% - ${state.characterPosition.toLocaleString()}/${fileSize.toLocaleString()} chars)`;
  } else {
    // Fallback to chunk-based if file size unknown
    progressInfo =
      state.estimatedChunks > 0
        ? ` (${state.chunkCounter}/${state.estimatedChunks})`
        : "";
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
  return `[${new Date().toLocaleTimeString()}] Chunk ${state.chunkCounter}${progress.progressInfo} @ pos ${state.characterPosition}: ${progress.totalFacts} total facts (+${newFactsCount} new), ${progress.totalGlobalContext} context items (+${newGlobalContextCount} new)`;
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
