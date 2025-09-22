import type { FactExtractionAgent } from "../agents/fact-extractor";
import { GraphitiClient } from "../graphiti-client/graphiti-client";
import type {
  ProcessingState,
  ProcessingConfig,
  ProcessingPaths,
} from "./types";
import * as FileOps from "./file-operations";
import * as ProcessingLogic from "./processing-logic";

export class DocumentProcessor {
  private state: ProcessingState;
  private config: ProcessingConfig;
  private paths: ProcessingPaths;
  private graphitiClient?: GraphitiClient;
  private graphitiAvailable = false;

  constructor(
    private readonly factAgent: FactExtractionAgent,
    private readonly file: Bun.BunFile,
    chunkSizeThreshold: number = 2000,
    enableGraphiti: boolean = false,
    resumeFromPosition: number = 0,
    existingGlobalContext: string[] = []
  ) {
    this.config = {
      chunkSizeThreshold,
      enableGraphiti,
      resumeFromPosition,
      existingGlobalContext,
      extractionTimeoutMs: 30000,
    };

    this.paths = FileOps.createProcessingPaths(file);
    this.state = ProcessingLogic.createInitialState(this.config);

    // Initialize Graphiti client if enabled
    if (this.config.enableGraphiti) {
      this.graphitiClient = new GraphitiClient();
    }
  }

  /** Static methods for external callers */
  static async getResumePosition(file: Bun.BunFile): Promise<number> {
    const paths = FileOps.createProcessingPaths(file);
    return FileOps.getResumePosition(paths.metadataPath);
  }

  static async getExistingGlobalContext(file: Bun.BunFile): Promise<string[]> {
    const paths = FileOps.createProcessingPaths(file);
    return FileOps.getExistingGlobalContext(paths.globalContextPath);
  }

  async start(): Promise<void> {
    await this.factAgent.start(this.file);

    // Get file size and estimate chunk count
    const fileSize = this.file.size || 0;
    const estimatedChunks = await FileOps.estimateChunkCount(
      this.file,
      this.config.chunkSizeThreshold
    );
    this.state = { ...this.state, estimatedChunks, fileSize };

    this.logStartupInfo();
    await this.initializeGraphiti();
    await this.initializeFiles();
  }

  async processChunk(para: string, chunkStartPosition?: number): Promise<void> {
    // Update state for this chunk
    this.state = ProcessingLogic.updateStateForChunk(
      this.state,
      chunkStartPosition,
      para.length
    );

    await this.processChunkWithTimeout(para);
  }

  async finalize(): Promise<{
    context: string[];
    currentContext: string[];
    outputDir: string;
    factsPath: string;
    metadataPath: string;
  }> {
    await this.factAgent.waitForIdle();
    await this.updateOutput();

    const totalFacts = await FileOps.getFileLineCount(this.paths.factsPath);
    this.logCompletionInfo(totalFacts);

    await this.markCompleted();

    return {
      context: this.factAgent.globalContext,
      currentContext: this.factAgent.currentContext,
      outputDir: this.paths.outputDir,
      factsPath: this.paths.factsPath,
      metadataPath: this.paths.metadataPath,
    };
  }

  /** Private orchestration methods */

  private async processChunkWithTimeout(para: string): Promise<void> {
    const processTimeoutMs = 35000; // 35 seconds
    const processTimeout = setTimeout(() => {
      console.error(
        `FORCED TERMINATION: Chunk ${this.state.chunkCounter} at position ${this.state.characterPosition} exceeded ${processTimeoutMs}ms`
      );
      console.error(
        `To resume, run: RESUME_FROM_POSITION=${this.state.characterPosition} bun run start`
      );
      console.error(`Failed chunk preview: ${para.substring(0, 200)}...`);
      process.exit(2);
    }, processTimeoutMs);

    try {
      await this.factAgent.extract(para);
      clearTimeout(processTimeout);
      await this.updateOutput();
    } catch (error) {
      clearTimeout(processTimeout);
      await this.handleProcessingError(error, para);
      throw error;
    }
  }

  private async handleProcessingError(
    error: unknown,
    para: string
  ): Promise<void> {
    console.error(
      `❌ Error processing chunk ${this.state.chunkCounter} at position ${this.state.characterPosition}:`,
      error
    );
    console.error(`📄 Chunk content preview: ${para.substring(0, 200)}...`);
    console.error(
      `🔄 To resume, run: RESUME_FROM_POSITION=${this.state.characterPosition} bun run start`
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

    // Save new data to files
    await this.saveProcessingResults(result);

    // Log progress
    await this.logProgress(result);

    // Update metadata
    await this.updateMetadata();

    // Send to Graphiti if enabled
    if (result.newFacts.length > 0) {
      await this.sendToGraphiti(result.newFacts);
    }
  }

  private async saveProcessingResults(result: {
    newFacts: any[];
    newGlobalContext: string[];
  }): Promise<void> {
    if (result.newGlobalContext.length > 0) {
      await FileOps.appendGlobalContext(
        this.paths.globalContextPath,
        result.newGlobalContext,
        this.state.chunkCounter,
        this.state.characterPosition
      );
    }

    if (result.newFacts.length > 0) {
      await FileOps.appendFacts(
        this.paths.factsPath,
        result.newFacts,
        this.factAgent.currentContext,
        this.state.chunkCounter,
        this.state.characterPosition
      );
    }
  }

  private async logProgress(result: {
    newFacts: any[];
    newGlobalContext: string[];
  }): Promise<void> {
    const totalFacts = await FileOps.getFileLineCount(this.paths.factsPath);
    const totalGlobalContext = await FileOps.getFileLineCount(
      this.paths.globalContextPath
    );

    const progress = ProcessingLogic.calculateProgress(
      this.state,
      totalFacts,
      totalGlobalContext,
      result.newFacts.length,
      result.newGlobalContext.length,
      this.state.fileSize
    );

    const logMessage = ProcessingLogic.formatProgressLog(
      this.state,
      progress,
      result.newFacts.length,
      result.newGlobalContext.length
    );

    console.log(logMessage);
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
    const metadata = ProcessingLogic.createDocumentMetadata(
      this.file,
      this.config,
      this.state,
      this.factAgent.currentContext
    );

    await FileOps.saveMetadata(this.paths.metadataPath, metadata);
  }

  private async markCompleted(): Promise<void> {
    const metadata = ProcessingLogic.createDocumentMetadata(
      this.file,
      this.config,
      this.state,
      this.factAgent.currentContext,
      "completed"
    );

    await FileOps.saveMetadata(this.paths.metadataPath, metadata);
  }

  private async initializeGraphiti(): Promise<void> {
    if (this.config.enableGraphiti && this.graphitiClient) {
      this.graphitiAvailable = await this.graphitiClient.isAvailable();
      if (this.graphitiAvailable) {
        console.log(
          "🔗 Graphiti server is available - facts will be sent to knowledge graph"
        );
      } else {
        console.warn(
          "⚠️  Graphiti server is not available - only writing to local files"
        );
      }
    }
  }

  private async sendToGraphiti(facts: any[]): Promise<void> {
    if (
      !this.config.enableGraphiti ||
      !this.graphitiClient ||
      !this.graphitiAvailable
    ) {
      return;
    }

    if (facts.length === 0) return;

    const episode = this.graphitiClient.createFactsEpisode(facts, {
      filename: this.file.name?.split("/").pop() || "unknown.txt",
      filepath: this.file.name || "",
      chunkIndex: this.state.chunkCounter,
      globalContext: this.state.lastFiveGlobalContext,
      currentContext: this.factAgent.currentContext,
    });

    // Send async (fire and forget)
    this.graphitiClient.sendEpisodeAsync(episode);
  }

  private logStartupInfo(): void {
    const filename = this.file.name?.split("/").pop() || "unknown.txt";
    const fileSizeInfo = this.state.fileSize
      ? ` (${this.state.fileSize.toLocaleString()} chars)`
      : "";

    console.log(`📄 Document: ${filename}${fileSizeInfo}`);
    console.log(
      `📊 Estimated chunks: ~${this.state.estimatedChunks} (threshold: ${this.config.chunkSizeThreshold} chars)`
    );
    console.log(`🤖 Starting with model: ${this.factAgent.currentModel}`);
  }

  private logCompletionInfo(totalFacts: number): void {
    const progressPercent = this.state.fileSize
      ? Math.min(
          100,
          (this.state.characterPosition / this.state.fileSize) * 100
        )
      : 0;

    const progressInfo = this.state.fileSize
      ? ` (${progressPercent.toFixed(1)}% of ${this.state.fileSize.toLocaleString()} chars)`
      : ` (${this.state.chunkCounter} chunks processed)`;

    console.log(`✅ Completed processing${progressInfo}`);
    console.log(`🤖 Final model: ${this.factAgent.currentModel}`);
    console.log(`📊 Total facts extracted: ${totalFacts}`);
    console.log(`📁 Output directory: ${this.paths.outputDir}`);
    console.log(`   ├── facts.jsonl`);
    console.log(`   ├── global_context.jsonl`);
    console.log(`   └── metadata.json`);
  }
}
