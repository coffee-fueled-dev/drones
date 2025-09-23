import type { FactExtractionAgent } from "../agents/fact-extractor";
import type {
  ProcessingState,
  ProcessingConfig,
  ProcessingPaths,
  Chunk,
  ProcessMetadata,
} from "./types";
import * as FileOps from "./file-operations";
import * as ProcessingLogic from "./processing-logic";

export class DocumentProcessor {
  private processMetadata: ProcessMetadata;
  private state: ProcessingState;
  private config: ProcessingConfig;
  private paths: ProcessingPaths;
  private currentChunk?: Chunk;
  private fileSize: number = 0;
  private description: string;

  constructor(
    private readonly factAgent: FactExtractionAgent,
    private readonly file: Bun.BunFile,
    chunkSizeThreshold: number = 2000,
    resumeFromPosition: number = 0,
    existingGlobalContext: string[] = [],
    description: string = ""
  ) {
    this.description = description;
    this.config = {
      chunkSizeThreshold,
      resumeFromPosition,
      existingGlobalContext,
      extractionTimeoutMs: 30000,
    };

    this.paths = FileOps.createProcessingPaths(file);
    this.state = ProcessingLogic.createInitialState(this.config);

    // Initialize process metadata with UUID
    this.processMetadata = ProcessingLogic.createProcessMetadata(
      Bun.randomUUIDv7(),
      this.file,
      this.config,
      0, // Will be updated in start()
      "processing",
      this.description
    );
  }

  /** Static methods for external callers */
  static async getResumePosition(file: Bun.BunFile): Promise<number> {
    const paths = FileOps.createProcessingPaths(file);
    return FileOps.getResumePosition(paths.metadataPath);
  }

  static async getExistingGlobalContext(file: Bun.BunFile): Promise<string[]> {
    const paths = FileOps.createProcessingPaths(file);
    return FileOps.getExistingGlobalContext(paths.chunksPath);
  }

  async start(): Promise<void> {
    await this.factAgent.start(this.file);

    // Get file size
    this.fileSize = this.file.size || 0;

    // Update process metadata with file size
    this.processMetadata = ProcessingLogic.createProcessMetadata(
      this.processMetadata.processId,
      this.file,
      this.config,
      this.fileSize,
      "processing",
      this.description
    );

    this.logStartupInfo();
    await this.initializeFiles();
  }

  async processChunk(para: string, chunkStartPosition?: number): Promise<void> {
    // Update state for this chunk
    this.state = ProcessingLogic.updateStateForChunk(
      this.state,
      chunkStartPosition,
      para.length
    );

    const processTimeoutMs = 35000; // 35 seconds
    const processTimeout = setTimeout(() => {
      console.error(
        `FORCED TERMINATION: Chunk ${this.state.chunkId} at position ${this.state.cursorPosition} exceeded ${processTimeoutMs}ms`
      );
      console.error(
        `To resume, run: RESUME_FROM_POSITION=${this.state.cursorPosition} bun run start`
      );
      console.error(`Failed chunk preview: ${para.substring(0, 200)}...`);
      process.exit(2);
    }, processTimeoutMs);

    try {
      await this.factAgent.extract(para, (extraction) => {
        // Update state with current contexts from fact agent
        this.state = ProcessingLogic.updateContextTracking(
          this.state,
          this.factAgent.currentContext,
          this.factAgent.globalContext
        );

        // Create chunk with extraction output and current contexts
        this.currentChunk = ProcessingLogic.createChunk(
          this.state,
          extraction,
          this.processMetadata
        );
      });

      clearTimeout(processTimeout);
      await this.updateOutput();
    } catch (error) {
      clearTimeout(processTimeout);
      await this.handleProcessingError(error, para);
      throw error;
    }
  }

  async finalize(): Promise<{
    context: string[];
    currentContext: string[];
    outputDir: string;
    chunksPath: string;
    metadataPath: string;
  }> {
    await this.factAgent.waitForIdle();
    await this.updateOutput();

    const totalChunks = await FileOps.getFileLineCount(this.paths.chunksPath);
    this.logCompletionInfo(totalChunks);

    await this.markCompleted();

    return {
      context: this.factAgent.globalContext,
      currentContext: this.factAgent.currentContext,
      outputDir: this.paths.outputDir,
      chunksPath: this.paths.chunksPath,
      metadataPath: this.paths.metadataPath,
    };
  }

  private async handleProcessingError(
    error: unknown,
    para: string
  ): Promise<void> {
    console.error(
      `❌ Error processing chunk ${this.state.chunkId} at position ${this.state.cursorPosition}:`,
      error
    );
    console.error(`📄 Chunk content preview: ${para.substring(0, 200)}...`);
    console.error(
      `🔄 To resume, run: RESUME_FROM_POSITION=${this.state.cursorPosition} bun run start`
    );

    // Save current position to metadata before exiting
    try {
      await this.updateMetadata();
    } catch (metadataError) {
      console.warn(`⚠️ Could not save metadata before exit: ${metadataError}`);
    }
  }

  private async updateOutput(): Promise<void> {
    const result = ProcessingLogic.processChunkData(this.factAgent, this.state);
    this.state = result.updatedState;

    // Log new global context if any
    if (
      ProcessingLogic.shouldLogNewGlobalContext(result.newGlobalContext.length)
    ) {
      const logMessage = ProcessingLogic.formatNewGlobalContextLog(
        result.newGlobalContext.length,
        this.factAgent.globalContext.length
      );
      console.log(logMessage);
    }

    // Save current chunk if it exists
    if (this.currentChunk) {
      await FileOps.appendChunk(this.paths.chunksPath, this.currentChunk);
    }

    // Log progress
    await this.logProgress(result);

    // Update metadata
    await this.updateMetadata();
  }

  private async logProgress(result: {
    newFacts: any[];
    newGlobalContext: string[];
  }): Promise<void> {
    const totalChunks = await FileOps.getFileLineCount(this.paths.chunksPath);

    const progress = ProcessingLogic.calculateProgress(
      this.state,
      result.newFacts.length,
      result.newGlobalContext.length,
      this.fileSize
    );

    console.log(
      `[${new Date().toLocaleTimeString()}] Chunk ${this.state.chunkId}${progress.progressInfo} - Total chunks: ${totalChunks}`
    );
  }

  private async initializeFiles(): Promise<void> {
    await FileOps.initializeOutputDirectory(this.paths);

    if (this.config.resumeFromPosition === 0) {
      await FileOps.clearOutputFiles(this.paths);
    } else {
      console.log(
        `🔄 Resuming extraction from position ${this.config.resumeFromPosition}`
      );
      if (this.config.existingGlobalContext.length > 0) {
        this.factAgent.restoreGlobalContext(this.config.existingGlobalContext);
        console.log(
          `📄 Restored ${this.config.existingGlobalContext.length} global context items`
        );
      }
    }

    await this.updateMetadata();
  }

  private async updateMetadata(): Promise<void> {
    // Update the lastUpdated field
    this.processMetadata = {
      ...this.processMetadata,
      lastUpdated: new Date().toISOString(),
    };

    await FileOps.saveMetadata(this.paths.metadataPath, this.processMetadata);
  }

  private async markCompleted(): Promise<void> {
    this.processMetadata = ProcessingLogic.createProcessMetadata(
      this.processMetadata.processId,
      this.file,
      this.config,
      this.fileSize,
      "completed",
      this.description
    );

    await FileOps.saveMetadata(this.paths.metadataPath, this.processMetadata);
  }

  private logStartupInfo(): void {
    const filename = this.file.name?.split("/").pop() || "unknown.txt";
    const fileSizeInfo = this.fileSize
      ? ` (${this.fileSize.toLocaleString()} chars)`
      : "";

    console.log(`📄 Document: ${filename}${fileSizeInfo}`);
    console.log(`🆔 Process ID: ${this.processMetadata.processId}`);
    console.log(`📊 Chunk threshold: ${this.config.chunkSizeThreshold} chars`);
    console.log(`🤖 Starting with model: ${this.factAgent.currentModel}`);
  }

  private logCompletionInfo(totalChunks: number): void {
    const progressPercent = this.fileSize
      ? Math.min(100, (this.state.cursorPosition / this.fileSize) * 100)
      : 0;

    const progressInfo = this.fileSize
      ? ` (${progressPercent.toFixed(1)}% of ${this.fileSize.toLocaleString()} chars)`
      : ` (${totalChunks} chunks processed)`;

    console.log(`✅ Completed processing${progressInfo}`);
    console.log(`🤖 Final model: ${this.factAgent.currentModel}`);
    console.log(`📊 Total chunks processed: ${totalChunks}`);
    console.log(`📁 Output directory: ${this.paths.outputDir}`);
    console.log(`   ├── chunks.jsonl`);
    console.log(`   └── metadata.json`);
  }
}
