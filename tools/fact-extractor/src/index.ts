import { Glob } from "bun";
import path from "path";
import { fileURLToPath } from "url";
import { FactExtractionAgent } from "./agents/fact-extractor";
import { DocumentProcessor } from "./document-processor";
import { Unicode } from "./unicode-reader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, "docs");

// Configuration for intelligent chunking
const CHUNK_SIZE_THRESHOLD = 3000; // Characters threshold for processing chunks

// Enable Graphiti integration (set to true to send episodes to Graphiti server)
const ENABLE_GRAPHITI = process.env.ENABLE_GRAPHITI === "true";

// Resume from position (set to resume processing from a specific character position)
const RESUME_FROM_POSITION = parseInt(
  process.env.RESUME_FROM_POSITION || "0",
  10
);

// Extraction timeout in milliseconds (default: 30 seconds)
const EXTRACTION_TIMEOUT = parseInt(
  process.env.EXTRACTION_TIMEOUT || "30000",
  10
);

for await (const entry of new Glob("**/*.txt").scan(DOCS_DIR)) {
  const resolved = path.join(DOCS_DIR, entry);
  const file = Bun.file(resolved);

  // Determine resume position: use env var, or load from existing metadata
  let resumePosition = RESUME_FROM_POSITION;
  let existingGlobalContext: string[] = [];

  if (resumePosition === 0) {
    resumePosition = await DocumentProcessor.getResumePosition(file);
  }

  // Load existing global context if resuming
  if (resumePosition > 0) {
    existingGlobalContext = await DocumentProcessor.getExistingGlobalContext(
      file
    );
  }

  const factAgent = new FactExtractionAgent(EXTRACTION_TIMEOUT);
  const processor = new DocumentProcessor(
    factAgent,
    file,
    CHUNK_SIZE_THRESHOLD,
    ENABLE_GRAPHITI,
    resumePosition,
    existingGlobalContext
  );

  console.log(`\n=== Processing ${entry} ===`);
  if (resumePosition > 0) {
    console.log(`🔄 Resuming from character position ${resumePosition}`);
  }
  console.log(`⏰ Extraction timeout: ${EXTRACTION_TIMEOUT}ms`);
  if (ENABLE_GRAPHITI) {
    console.log(
      "📊 Graphiti integration enabled - episodes will be sent to knowledge graph"
    );
  }

  await processor.start();

  // If your docs come from PDFs/Windows sources, try windows-1252; else keep UTF-8.
  // const decoder = new TextDecoder("windows-1252", { fatal: false });
  const decoder = new TextDecoder(); // UTF-8
  let carry = "";
  let accumulatedChunk = "";
  let chunkCount = 0;
  let currentPosition = 0;
  let skippedToResumePosition = resumePosition === 0;

  // Stream bytes and decode incrementally (handles multi-byte splits at chunk boundaries)
  for await (const chunk of Unicode.stream(file)) {
    carry += chunk.join("");

    // Split on SINGLE newline, not blank line
    // Use exec to capture the *first* newline and know how many chars to skip (1 vs 2).
    // No /g flag so it always finds from index 0.
    let m;
    const NL = /\r?\n/;
    while ((m = NL.exec(carry)) !== null) {
      const idx = m.index;
      const para = carry.slice(0, idx).trim();

      if (para) {
        // Update current position
        currentPosition += para.length + 1; // +1 for the newline

        // Skip content until we reach resume position
        if (!skippedToResumePosition) {
          if (currentPosition < resumePosition) {
            // Skip this paragraph - we haven't reached resume position yet
            continue;
          } else {
            skippedToResumePosition = true;
            console.log(
              `🎯 Reached resume position at character ${currentPosition}`
            );
          }
        }

        // Add paragraph to accumulated chunk
        if (accumulatedChunk) {
          accumulatedChunk += "\n" + para;
        } else {
          accumulatedChunk = para;
        }

        // Check if we should process the accumulated chunk
        if (accumulatedChunk.length >= CHUNK_SIZE_THRESHOLD) {
          chunkCount++;
          const chunkStartPosition = currentPosition - accumulatedChunk.length;
          console.log(
            `Processing chunk ${chunkCount} (${accumulatedChunk.length} chars) @ pos ${chunkStartPosition}`
          );

          try {
            await processor.processChunk(accumulatedChunk, chunkStartPosition);
            accumulatedChunk = "";
          } catch (error) {
            console.error(
              `💥 Failed at chunk ${chunkCount}, position ${chunkStartPosition}`
            );
            console.error(
              `💡 To resume from this position, run: RESUME_FROM_POSITION=${chunkStartPosition} bun run start`
            );

            // Check if this is a timeout error and exit with code 2 for auto-resume
            if (error instanceof Error && error.message.includes("timed out")) {
              console.error(
                `⏰ Timeout detected - exiting with code 2 for auto-resume`
              );
              process.exit(2);
            }

            throw error;
          }
        }
      }

      // Drop the matched newline(s) and everything before it.
      const skip = m[0].length; // 1 for \n, 2 for \r\n
      carry = carry.slice(idx + skip);
      // Reset regex state because we sliced the string
      NL.lastIndex = 0;
    }
  }

  // Flush decoder remainder (important for UTF-8 multi-byte endings)
  carry += decoder.decode();

  if (carry.trim()) {
    if (accumulatedChunk) {
      accumulatedChunk += "\n" + carry.trim();
    } else {
      accumulatedChunk = carry.trim();
    }
  }

  // Process any remaining accumulated chunk
  if (accumulatedChunk.trim() && skippedToResumePosition) {
    chunkCount++;
    const chunkStartPosition = currentPosition - accumulatedChunk.length;
    console.log(
      `Processing final chunk ${chunkCount} (${accumulatedChunk.length} chars) @ pos ${chunkStartPosition}`
    );

    try {
      await processor.processChunk(accumulatedChunk.trim(), chunkStartPosition);
    } catch (error) {
      console.error(
        `💥 Failed at final chunk ${chunkCount}, position ${chunkStartPosition}`
      );
      console.error(
        `💡 To resume from this position, run: RESUME_FROM_POSITION=${chunkStartPosition} bun run start`
      );

      // Check if this is a timeout error and exit with code 2 for auto-resume
      if (error instanceof Error && error.message.includes("timed out")) {
        console.error(
          `⏰ Timeout detected - exiting with code 2 for auto-resume`
        );
        process.exit(2);
      }

      throw error;
    }
  }

  const { context, factsPath, metadataPath } = await processor.finalize();
  console.log(`\n=== Completed ${entry} ===`);
  console.log(`Output written to: ${factsPath}`);
  console.log(`Metadata written to: ${metadataPath}`);
  console.log(
    `Final stats: ${chunkCount} chunks processed, ${context.length} context items`
  );
}
