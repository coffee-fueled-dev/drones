import path from "path";
import fs from "node:fs";
import type {
  ProcessMetadata,
  ProcessingPaths,
  ResumeInfo,
  Chunk,
} from "./types";

/** Pure functions for file system operations */

export function createProcessingPaths(file: Bun.BunFile): ProcessingPaths {
  const filename = path.basename(file.name || "unknown.txt");
  const baseName = filename.replace(/\.[^/.]+$/, "");
  const sourceDir = path.dirname(file.name || ".");
  const outputDir = path.join(sourceDir, baseName);

  return {
    outputDir,
    metadataPath: path.join(outputDir, "metadata.json"),
    chunksPath: path.join(outputDir, "chunks.jsonl"),
  };
}

export async function getResumeInfo(file: Bun.BunFile): Promise<ResumeInfo> {
  const paths = createProcessingPaths(file);

  // Get position from metadata
  const position = await getResumePosition(paths.metadataPath);

  // Get existing global context
  const existingGlobalContext = await getExistingGlobalContext(
    paths.chunksPath
  );

  return { position, existingGlobalContext };
}

export async function getResumePosition(metadataPath: string): Promise<number> {
  try {
    const metadataFile = Bun.file(metadataPath);
    if (await metadataFile.exists()) {
      const metadata = await metadataFile.json();
      return metadata.cursorPosition || 0;
    }
  } catch (error) {
    console.warn("Could not load existing metadata for resume:", error);
  }
  return 0;
}

export async function getExistingGlobalContext(
  chunksPath: string
): Promise<string[]> {
  try {
    const chunksFile = Bun.file(chunksPath);
    if (await chunksFile.exists()) {
      const content = await chunksFile.text();
      if (!content.trim()) return [];

      // Parse all chunks and extract global context from the last few chunks
      const chunks = content
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((chunk): chunk is Chunk => chunk !== null);

      // Get last 5 global context entries from recent chunks
      const recentChunks = chunks.slice(-10); // Look at last 10 chunks
      const globalContext: string[] = [];

      for (const chunk of recentChunks) {
        if (chunk.context?.lastFiveGlobal) {
          globalContext.push(...chunk.context.lastFiveGlobal);
        }
      }

      // Return only the last 5 unique entries
      return [...new Set(globalContext)].slice(-5);
    }
  } catch (error) {
    console.warn("Could not load existing global context for resume:", error);
  }
  return [];
}

export async function initializeOutputDirectory(
  paths: ProcessingPaths
): Promise<void> {
  if (!fs.existsSync(paths.outputDir)) {
    fs.mkdirSync(paths.outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${paths.outputDir}`);
  }
}

export async function clearOutputFiles(paths: ProcessingPaths): Promise<void> {
  await Bun.write(paths.chunksPath, "");
  console.log(`🆕 Starting fresh extraction`);
}

export async function saveMetadata(
  metadataPath: string,
  metadata: ProcessMetadata
): Promise<void> {
  await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));
}

export async function appendChunk(
  chunksPath: string,
  chunk: Chunk
): Promise<void> {
  const timestamp = new Date().toISOString();
  const chunkWithTimestamp = {
    ...chunk,
    timestamp,
  };

  const jsonlLine = JSON.stringify(chunkWithTimestamp) + "\n";

  const file = Bun.file(chunksPath);
  let existingContent = "";

  if (await file.exists()) {
    existingContent = await file.text();
  }

  await Bun.write(chunksPath, existingContent + jsonlLine);
}

export async function getFileLineCount(filePath: string): Promise<number> {
  try {
    const content = await Bun.file(filePath).text();
    if (!content.trim()) return 0;

    return content
      .trim()
      .split("\n")
      .filter((line) => line.trim()).length;
  } catch (error) {
    return 0;
  }
}
