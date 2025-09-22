import path from "path";
import fs from "node:fs";
import type { Fact } from "../agents/fact-extractor";
import type { DocumentMetadata, ProcessingPaths, ResumeInfo } from "./types";

/** Pure functions for file system operations */

export function createProcessingPaths(file: Bun.BunFile): ProcessingPaths {
  const filename = path.basename(file.name || "unknown.txt");
  const baseName = filename.replace(/\.[^/.]+$/, "");
  const sourceDir = path.dirname(file.name || ".");
  const outputDir = path.join(sourceDir, baseName);

  return {
    outputDir,
    factsPath: path.join(outputDir, "facts.jsonl"),
    globalContextPath: path.join(outputDir, "global_context.jsonl"),
    metadataPath: path.join(outputDir, "metadata.json"),
  };
}

export async function getResumeInfo(file: Bun.BunFile): Promise<ResumeInfo> {
  const paths = createProcessingPaths(file);

  // Get position from metadata
  const position = await getResumePosition(paths.metadataPath);

  // Get existing global context
  const existingGlobalContext = await getExistingGlobalContext(
    paths.globalContextPath
  );

  return { position, existingGlobalContext };
}

export async function getResumePosition(metadataPath: string): Promise<number> {
  try {
    const metadataFile = Bun.file(metadataPath);
    if (await metadataFile.exists()) {
      const metadata = await metadataFile.json();
      return metadata.characterPosition || 0;
    }
  } catch (error) {
    console.warn("Could not load existing metadata for resume:", error);
  }
  return 0;
}

export async function getExistingGlobalContext(
  globalContextPath: string
): Promise<string[]> {
  try {
    const globalContextFile = Bun.file(globalContextPath);
    if (await globalContextFile.exists()) {
      const content = await globalContextFile.text();
      if (!content.trim()) return [];

      // Parse all entries and extract just the content, keeping only last 5
      const entries = content
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line).content;
          } catch {
            return null;
          }
        })
        .filter((content): content is string => content !== null);

      // Return only the last 5 entries
      return entries.slice(-5);
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
  await Bun.write(paths.factsPath, "");
  await Bun.write(paths.globalContextPath, "");
  console.log(`🆕 Starting fresh extraction`);
}

export async function saveMetadata(
  metadataPath: string,
  metadata: DocumentMetadata
): Promise<void> {
  await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));
}

export async function appendFacts(
  factsPath: string,
  facts: Fact[],
  currentContext: string[],
  chunkIndex: number,
  characterPosition: number
): Promise<void> {
  if (facts.length === 0) return;

  const timestamp = new Date().toISOString();
  const jsonlLines =
    facts
      .map((fact) =>
        JSON.stringify({
          ...fact,
          currentContext,
          timestamp,
          chunkIndex,
          characterPosition,
        })
      )
      .join("\n") + "\n";

  const file = Bun.file(factsPath);
  const existingContent = await file.text();
  await Bun.write(factsPath, existingContent + jsonlLines);
}

export async function appendGlobalContext(
  globalContextPath: string,
  contextEntries: string[],
  chunkIndex: number,
  characterPosition: number
): Promise<void> {
  if (contextEntries.length === 0) return;

  const timestamp = new Date().toISOString();
  const jsonlLines =
    contextEntries
      .map((entry) =>
        JSON.stringify({
          content: entry,
          timestamp,
          chunkIndex,
          characterPosition,
        })
      )
      .join("\n") + "\n";

  const file = Bun.file(globalContextPath);
  const existingContent = await file.text();
  await Bun.write(globalContextPath, existingContent + jsonlLines);
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

export async function estimateChunkCount(
  file: Bun.BunFile,
  chunkSizeThreshold: number
): Promise<number> {
  try {
    const fileSize = file.size;
    if (!fileSize) {
      // If we can't get file size, try reading the content
      const content = await file.text();
      const contentLength = content.length;
      const estimatedChunks = Math.ceil(contentLength / chunkSizeThreshold);
      return Math.max(1, estimatedChunks);
    }

    // Rough estimation: file size in bytes ≈ characters for text files
    // Add some buffer since chunking considers paragraph boundaries
    const estimatedChunks = Math.ceil((fileSize * 1.2) / chunkSizeThreshold);
    return Math.max(1, estimatedChunks);
  } catch (error) {
    console.warn(`Could not estimate chunk count: ${error}`);
    return 1;
  }
}
