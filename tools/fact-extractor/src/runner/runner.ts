import { FactExtractionAgent } from "../agents/fact-extractor";
import { DocumentProcessor } from "../document-processor";
import { streamFileChunks } from "./streaming";
import type { RunnerConfig, ProcessingResult } from "./types";

export class Runner {
  private config: RunnerConfig;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  async processFile(file: Bun.BunFile): Promise<ProcessingResult> {
    const filename = this.getFilename(file);
    console.log(`\n=== Processing ${filename} ===`);

    // Determine resume position and existing context
    const resumePosition = await this.determineResumePosition(file);
    const existingGlobalContext = await this.getExistingContext(
      file,
      resumePosition
    );

    this.logProcessingStart(filename, resumePosition);

    // Create agent and processor
    const factAgent = new FactExtractionAgent(this.config.extractionTimeoutMs);
    const processor = new DocumentProcessor(
      factAgent,
      file,
      this.config.chunkSizeThreshold,
      this.config.enableGraphiti,
      resumePosition,
      existingGlobalContext
    );

    await processor.start();

    // Process file chunks
    const chunksProcessed = await this.processFileChunks(
      file,
      processor,
      resumePosition
    );

    // Finalize processing
    const result = await processor.finalize();

    console.log(`\n=== Completed ${filename} ===`);
    console.log(`Output written to: ${result.factsPath}`);
    console.log(`Metadata written to: ${result.metadataPath}`);
    console.log(
      `Final stats: ${chunksProcessed} chunks processed, ${result.context.length} context items`
    );

    return {
      filename,
      chunksProcessed,
      contextItems: result.context.length,
      factsPath: result.factsPath,
      metadataPath: result.metadataPath,
      outputDir: result.outputDir,
    };
  }

  private async processFileChunks(
    file: Bun.BunFile,
    processor: DocumentProcessor,
    resumePosition: number
  ): Promise<number> {
    let chunksProcessed = 0;

    try {
      for await (const chunk of streamFileChunks(
        file,
        this.config.chunkSizeThreshold,
        resumePosition
      )) {
        await this.processChunkWithErrorHandling(
          processor,
          chunk.content,
          chunk.startPosition,
          chunksProcessed + 1
        );
        chunksProcessed++;
      }
    } catch (error) {
      console.error(`💥 Processing failed after ${chunksProcessed} chunks`);
      throw error;
    }

    return chunksProcessed;
  }

  private async processChunkWithErrorHandling(
    processor: DocumentProcessor,
    content: string,
    startPosition: number,
    chunkNumber: number
  ): Promise<void> {
    try {
      await processor.processChunk(content, startPosition);
    } catch (error) {
      console.error(
        `💥 Failed at chunk ${chunkNumber}, position ${startPosition}`
      );
      console.error(
        `💡 To resume from this position, run: RESUME_FROM_POSITION=${startPosition} bun run start`
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

  private async determineResumePosition(file: Bun.BunFile): Promise<number> {
    // Use config override if provided
    if (this.config.resumeFromPosition !== undefined) {
      return this.config.resumeFromPosition;
    }

    // Otherwise load from metadata
    return DocumentProcessor.getResumePosition(file);
  }

  private async getExistingContext(
    file: Bun.BunFile,
    resumePosition: number
  ): Promise<string[]> {
    if (resumePosition > 0) {
      return DocumentProcessor.getExistingGlobalContext(file);
    }
    return [];
  }

  private getFilename(file: Bun.BunFile): string {
    return file.name?.split("/").pop() || "unknown.txt";
  }

  private logProcessingStart(filename: string, resumePosition: number): void {
    if (resumePosition > 0) {
      console.log(`🔄 Resuming from character position ${resumePosition}`);
    }
    console.log(`⏰ Extraction timeout: ${this.config.extractionTimeoutMs}ms`);
    if (this.config.enableGraphiti) {
      console.log(
        "📊 Graphiti integration enabled - episodes will be sent to knowledge graph"
      );
    }
  }
}
