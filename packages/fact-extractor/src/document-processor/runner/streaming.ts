import { Unicode } from "../unicode-reader/unicode-reader";

/** Pure functions for file streaming and text processing */

export interface StreamChunk {
  content: string;
  startPosition: number;
  endPosition: number;
}

export interface StreamState {
  carry: string;
  accumulatedChunk: string;
  currentPosition: number;
  chunkCount: number;
  skippedToResumePosition: boolean;
}

export function createInitialStreamState(resumePosition: number): StreamState {
  return {
    carry: "",
    accumulatedChunk: "",
    currentPosition: 0,
    chunkCount: 0,
    skippedToResumePosition: resumePosition === 0,
  };
}

export function shouldProcessParagraph(
  state: StreamState,
  resumePosition: number
): { shouldProcess: boolean; updatedState: StreamState } {
  if (state.skippedToResumePosition) {
    return { shouldProcess: true, updatedState: state };
  }

  if (state.currentPosition < resumePosition) {
    return { shouldProcess: false, updatedState: state };
  }

  console.log(
    `🎯 Reached resume position at character ${state.currentPosition}`
  );
  return {
    shouldProcess: true,
    updatedState: {
      ...state,
      skippedToResumePosition: true,
      accumulatedChunk: "", // Clear any accumulated content from skip phase
    },
  };
}

export function shouldProcessChunk(
  accumulatedChunk: string,
  threshold: number
): boolean {
  return accumulatedChunk.length >= threshold;
}

export function createChunkForProcessing(
  accumulatedChunk: string,
  currentPosition: number,
  chunkCount: number
): StreamChunk {
  const startPosition = currentPosition - accumulatedChunk.length;

  console.log(
    `Processing chunk ${chunkCount} (${accumulatedChunk.length} chars) @ pos ${startPosition}`
  );

  return {
    content: accumulatedChunk,
    startPosition,
    endPosition: currentPosition,
  };
}

/**
 * NOTE: Position tracking and content accumulation logic moved inline
 * to fix resume issue where content was accumulated during skip phase,
 * causing massive first chunks when resuming from a position.
 *
 * Now we:
 * 1. Always track position (for resume logic)
 * 2. Only accumulate content AFTER reaching resume position
 * 3. Clear accumulated content when transitioning to process mode
 */

export function updateStreamStateAfterChunk(state: StreamState): StreamState {
  return {
    ...state,
    chunkCount: state.chunkCount + 1,
    accumulatedChunk: "",
  };
}

export function processCarryWithNewline(carry: string): {
  paragraph: string | null;
  remainingCarry: string;
} {
  const NL = /\r?\n/;
  const match = NL.exec(carry);

  if (match === null) {
    return { paragraph: null, remainingCarry: carry };
  }

  const idx = match.index;
  const paragraph = carry.slice(0, idx).trim();
  const skip = match[0].length; // 1 for \n, 2 for \r\n
  const remainingCarry = carry.slice(idx + skip);

  return {
    paragraph: paragraph || null,
    remainingCarry,
  };
}

export async function* streamFileChunks(
  file: Bun.BunFile,
  chunkSizeThreshold: number,
  resumePosition: number = 0
): AsyncGenerator<StreamChunk> {
  const decoder = new TextDecoder(); // UTF-8
  let state = createInitialStreamState(resumePosition);

  // Stream bytes and decode incrementally
  for await (const chunk of Unicode.stream(file)) {
    state.carry += chunk.join("");

    // Process all complete lines in the carry buffer
    while (true) {
      const { paragraph, remainingCarry } = processCarryWithNewline(
        state.carry
      );
      state.carry = remainingCarry;

      if (paragraph === null) break; // No more complete lines
      if (!paragraph) continue; // Empty paragraph, skip

      // Update position first (always track position)
      const newPosition = state.currentPosition + paragraph.length + 1; // +1 for newline
      state = { ...state, currentPosition: newPosition };

      // Check if we should process this paragraph (resume logic)
      const { shouldProcess, updatedState } = shouldProcessParagraph(
        state,
        resumePosition
      );
      state = updatedState;

      if (!shouldProcess) continue;

      // Only accumulate content after we reach the resume position
      const newAccumulated = state.accumulatedChunk
        ? state.accumulatedChunk + "\n" + paragraph
        : paragraph;
      state = { ...state, accumulatedChunk: newAccumulated };

      // Check if we should emit a chunk
      if (shouldProcessChunk(state.accumulatedChunk, chunkSizeThreshold)) {
        const streamChunk = createChunkForProcessing(
          state.accumulatedChunk,
          state.currentPosition,
          state.chunkCount + 1
        );

        state = updateStreamStateAfterChunk(state);
        yield streamChunk;
      }
    }
  }

  // Flush decoder remainder
  state.carry += decoder.decode();

  // Process any remaining content
  if (state.carry.trim() && state.skippedToResumePosition) {
    const finalContent = state.carry.trim();
    // Update position and accumulate content
    const newPosition = state.currentPosition + finalContent.length;
    const newAccumulated = state.accumulatedChunk
      ? state.accumulatedChunk + "\n" + finalContent
      : finalContent;
    state = {
      ...state,
      currentPosition: newPosition,
      accumulatedChunk: newAccumulated,
    };
  }

  // Process any remaining accumulated content, respecting chunk size threshold
  while (state.accumulatedChunk.trim() && state.skippedToResumePosition) {
    const trimmedContent = state.accumulatedChunk.trim();

    if (trimmedContent.length <= chunkSizeThreshold) {
      // Small enough - emit as final chunk
      const finalChunk = createChunkForProcessing(
        trimmedContent,
        state.currentPosition,
        state.chunkCount + 1
      );

      console.log(
        `Processing final chunk ${finalChunk.startPosition} (${finalChunk.content.length} chars) @ pos ${finalChunk.startPosition}`
      );

      yield finalChunk;
      break;
    } else {
      // Too large - split at paragraph boundaries near threshold
      const lines = trimmedContent.split("\n");
      let chunkContent = "";
      let remainingContent = "";
      let splitFound = false;

      for (let i = 0; i < lines.length; i++) {
        const testContent =
          chunkContent + (chunkContent ? "\n" : "") + lines[i];

        if (
          testContent.length > chunkSizeThreshold &&
          chunkContent.length > 0
        ) {
          // Found a good split point
          remainingContent = lines.slice(i).join("\n");
          splitFound = true;
          break;
        }
        chunkContent = testContent;
      }

      if (!splitFound) {
        // Couldn't split at paragraph boundary - force split at threshold
        chunkContent = trimmedContent.substring(0, chunkSizeThreshold);
        remainingContent = trimmedContent.substring(chunkSizeThreshold);
      }

      // Emit this chunk
      const chunk = createChunkForProcessing(
        chunkContent,
        state.currentPosition - trimmedContent.length + chunkContent.length,
        state.chunkCount + 1
      );

      state = updateStreamStateAfterChunk(state);
      state = { ...state, accumulatedChunk: remainingContent };

      yield chunk;
    }
  }
}
