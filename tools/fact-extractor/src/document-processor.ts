import path from "path";
import fs from "node:fs";
import type { Fact, FactExtractionAgent } from "./agents/fact-extractor";
import { GraphitiClient } from "./graphiti-client";

interface OutputData {
  metadata: {
    filename: string;
    filepath: string;
    processedAt: string;
    lastUpdated: string;
    chunkSizeThreshold: number;
  };
}

export class DocumentProcessor {
  /** Load existing metadata to determine resume position */
  static async getResumePosition(file: Bun.BunFile): Promise<number> {
    try {
      const filename = path.basename(file.name || "unknown.txt");
      const baseName = filename.replace(/\.[^/.]+$/, "");
      const sourceDir = path.dirname(file.name || ".");
      const outputDir = path.join(sourceDir, baseName);
      const metadataPath = path.join(outputDir, "metadata.json");

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

  /** Load existing global context for resuming */
  static async getExistingGlobalContext(file: Bun.BunFile): Promise<string[]> {
    try {
      const filename = path.basename(file.name || "unknown.txt");
      const baseName = filename.replace(/\.[^/.]+$/, "");
      const sourceDir = path.dirname(file.name || ".");
      const outputDir = path.join(sourceDir, baseName);
      const globalContextPath = path.join(outputDir, "global_context.jsonl");

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
          .filter((content) => content !== null);

        // Return only the last 5 entries
        return entries.slice(-5);
      }
    } catch (error) {
      console.warn("Could not load existing global context for resume:", error);
    }
    return [];
  }

  private factsPath: string;
  private globalContextPath: string;
  private metadataPath: string;
  private outputDir: string;
  private outputData: OutputData;
  private chunkCounter = 0;
  private estimatedChunks = 0;
  private characterPosition = 0;
  private lastFiveGlobalContext: string[] = [];
  private graphitiClient?: GraphitiClient;
  private graphitiAvailable = false;
  private factsFileHandle?: Bun.BunFile;

  constructor(
    private readonly factAgent: FactExtractionAgent,
    private readonly file: Bun.BunFile,
    private readonly chunkSizeThreshold: number = 2000,
    private readonly enableGraphiti: boolean = false,
    private readonly resumeFromPosition: number = 0,
    private readonly existingGlobalContext: string[] = []
  ) {
    const filename = path.basename(file.name || "unknown.txt");
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const sourceDir = path.dirname(file.name || ".");

    // Create a folder named after the source file
    this.outputDir = path.join(sourceDir, baseName);

    // Create separate files within the folder
    this.factsPath = path.join(this.outputDir, "facts.jsonl");
    this.globalContextPath = path.join(this.outputDir, "global_context.jsonl");
    this.metadataPath = path.join(this.outputDir, "metadata.json");

    this.outputData = {
      metadata: {
        filename,
        filepath: file.name || "",
        processedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        chunkSizeThreshold: this.chunkSizeThreshold,
      },
    };

    // Set starting character position for resume functionality
    this.characterPosition = this.resumeFromPosition;

    // Initialize with existing global context if resuming
    this.lastFiveGlobalContext = [...this.existingGlobalContext];

    // Initialize Graphiti client if enabled
    if (this.enableGraphiti) {
      this.graphitiClient = new GraphitiClient();
    }
  }

  async start() {
    await this.factAgent.start(this.file);

    // Estimate chunk count
    this.estimatedChunks = await this.estimateChunkCount();
    console.log(`📄 Document: ${this.outputData.metadata.filename}`);
    console.log(
      `📊 Estimated chunks: ~${this.estimatedChunks} (threshold: ${this.chunkSizeThreshold} chars)`
    );
    console.log(`🤖 Starting with model: ${this.factAgent.currentModel}`);

    // Check Graphiti availability if enabled
    if (this.enableGraphiti && this.graphitiClient) {
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

    // Initialize the facts file and write initial metadata
    await this.initializeFiles();
  }

  /** Feed a paragraph; emits fact extraction when a semantic boundary is hit. */
  processChunk = async (para: string, chunkStartPosition?: number) => {
    this.chunkCounter++;
    if (chunkStartPosition !== undefined) {
      this.characterPosition = chunkStartPosition;
    } else {
      this.characterPosition += para.length;
    }

    // Set up a process-level timeout that will forcefully terminate if extraction hangs
    const processTimeoutMs = 35000; // 35 seconds - slightly longer than extraction timeout
    const processTimeout = setTimeout(() => {
      console.error(
        `FORCED TERMINATION: Chunk ${this.chunkCounter} at position ${this.characterPosition} exceeded ${processTimeoutMs}ms`
      );
      console.error(
        `To resume, run: RESUME_FROM_POSITION=${this.characterPosition} bun run start`
      );
      console.error(`Failed chunk preview: ${para.substring(0, 200)}...`);
      process.exit(2); // Exit with code 2 to indicate timeout termination
    }, processTimeoutMs);

    try {
      await this.factAgent.extract(para);
      clearTimeout(processTimeout);
      await this.updateOutput();
    } catch (error) {
      clearTimeout(processTimeout);
      console.error(
        `❌ Error processing chunk ${this.chunkCounter} at position ${this.characterPosition}:`,
        error
      );
      // Log the chunk content for debugging
      console.error(`📄 Chunk content preview: ${para.substring(0, 200)}...`);
      console.error(
        `🔄 To resume, run: RESUME_FROM_POSITION=${this.characterPosition} bun run start`
      );
      throw error;
    }
  };

  /** Update output file with latest facts and context */
  private async updateOutput() {
    const currentGlobalContext = this.factAgent.globalContext;

    // Detect new global context entries by comparing with our last known state
    const newGlobalContext = currentGlobalContext.filter((entry) => {
      // Only consider it "new" if it's not in our last known state
      return !this.lastFiveGlobalContext.includes(entry);
    });

    // Update our tracking to only keep last 5 entries
    this.lastFiveGlobalContext = [...currentGlobalContext.slice(-5)];

    // Get new facts since last update (this prevents unbounded accumulation)
    const newFacts = this.factAgent.flushFacts();
    this.outputData.metadata.lastUpdated = new Date().toISOString();

    const progressInfo =
      this.estimatedChunks > 0
        ? ` (${this.chunkCounter}/${this.estimatedChunks})`
        : "";

    // Append new global context to JSONL file
    if (newGlobalContext.length > 0) {
      console.log(
        `[DocumentProcessor] 📝 Detected ${newGlobalContext.length} new context entries out of ${currentGlobalContext.length} total`
      );
      await this.appendGlobalContext(newGlobalContext);
    }

    // Append new facts to the JSONL file
    if (newFacts.length > 0) {
      await this.appendFacts(newFacts, this.factAgent.currentContext);
    }

    // Get total fact count for logging
    const totalFacts = await this.getTotalFactCount();
    const totalGlobalContext = await this.getTotalGlobalContextCount();

    console.log(
      `[${new Date(Date.now()).toLocaleTimeString()}] Chunk ${
        this.chunkCounter
      }${progressInfo} @ pos ${
        this.characterPosition
      }: ${totalFacts} total facts (+${
        newFacts.length
      } new), ${totalGlobalContext} context items (+${
        newGlobalContext.length
      } new)`
    );

    // Update metadata file
    await this.updateMetadata();

    // Send only new facts to Graphiti (non-blocking) to avoid duplicates
    if (newFacts.length > 0) {
      await this.sendToGraphiti(newFacts);
    }
  }

  /** Initialize the facts and metadata files */
  private async initializeFiles() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.outputDir}`);
    }

    // If resuming, don't clear files
    if (this.resumeFromPosition === 0) {
      // Clear files (start fresh)
      await Bun.write(this.factsPath, "");
      await Bun.write(this.globalContextPath, "");
      console.log(`🆕 Starting fresh extraction`);
    } else {
      console.log(
        `🔄 Resuming extraction from position ${this.resumeFromPosition}`
      );
      // Initialize agent with existing global context
      if (this.existingGlobalContext.length > 0) {
        this.factAgent.restoreGlobalContext(this.existingGlobalContext);
        console.log(
          `📄 Restored ${this.existingGlobalContext.length} global context items`
        );
      }
    }

    // Write initial metadata
    await this.updateMetadata();
  }

  /** Append new facts to the JSONL facts file */
  private async appendFacts(facts: Fact[], currentContext: string[]) {
    if (facts.length === 0) return;

    // Convert facts to JSONL format with cursor metadata (one JSON object per line)
    const timestamp = new Date().toISOString();
    const chunkIndex = this.chunkCounter;
    const jsonlLines =
      facts
        .map((fact) =>
          JSON.stringify({
            ...fact,
            currentContext,
            timestamp,
            chunkIndex,
            characterPosition: this.characterPosition,
          })
        )
        .join("\n") + "\n";

    // Append to the facts file
    const file = Bun.file(this.factsPath);
    const existingContent = await file.text();
    await Bun.write(this.factsPath, existingContent + jsonlLines);
  }

  /** Append new global context entries to the JSONL global context file */
  private async appendGlobalContext(contextEntries: string[]) {
    if (contextEntries.length === 0) return;

    // Convert context entries to JSONL format with timestamp
    const timestamp = new Date().toISOString();
    const chunkIndex = this.chunkCounter;
    const jsonlLines =
      contextEntries
        .map((entry) =>
          JSON.stringify({
            content: entry,
            timestamp,
            chunkIndex,
            characterPosition: this.characterPosition,
          })
        )
        .join("\n") + "\n";

    // Append to the global context file
    const file = Bun.file(this.globalContextPath);
    const existingContent = await file.text();
    await Bun.write(this.globalContextPath, existingContent + jsonlLines);
  }

  /** Update the metadata file */
  private async updateMetadata() {
    const metadata = {
      ...this.outputData.metadata,
      currentContext: this.factAgent.currentContext,
      totalChunks: this.chunkCounter,
      estimatedChunks: this.estimatedChunks,
      characterPosition: this.characterPosition,
      factsFile: "facts.jsonl",
      globalContextFile: "global_context.jsonl",
      status: "processing",
      lastChunkProcessedAt: new Date().toISOString(),
    };

    await Bun.write(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  /** Get total count of facts from the JSONL file */
  private async getTotalFactCount(): Promise<number> {
    try {
      const content = await Bun.file(this.factsPath).text();
      if (!content.trim()) return 0;

      // Count non-empty lines in JSONL file
      return content
        .trim()
        .split("\n")
        .filter((line) => line.trim()).length;
    } catch (error) {
      return 0;
    }
  }

  /** Get total count of global context entries from the JSONL file */
  private async getTotalGlobalContextCount(): Promise<number> {
    try {
      const content = await Bun.file(this.globalContextPath).text();
      if (!content.trim()) return 0;

      // Count non-empty lines in JSONL file
      return content
        .trim()
        .split("\n")
        .filter((line) => line.trim()).length;
    } catch (error) {
      return 0;
    }
  }

  /** Send facts to Graphiti server (non-blocking) */
  private async sendToGraphiti(factsToSend?: Fact[]) {
    if (
      !this.enableGraphiti ||
      !this.graphitiClient ||
      !this.graphitiAvailable
    ) {
      return;
    }

    const facts = factsToSend ?? [];

    // Only send if we have facts
    if (facts.length === 0) {
      return;
    }

    const episode = this.graphitiClient.createFactsEpisode(facts, {
      filename: this.outputData.metadata.filename,
      filepath: this.outputData.metadata.filepath,
      chunkIndex: this.chunkCounter,
      globalContext: this.lastFiveGlobalContext,
      currentContext: this.factAgent.currentContext,
    });

    // Send async (fire and forget) - this won't block the processing
    this.graphitiClient.sendEpisodeAsync(episode);
  }

  /** Estimate the number of chunks this document will generate */
  private async estimateChunkCount(): Promise<number> {
    try {
      const fileSize = this.file.size;
      if (!fileSize) {
        // If we can't get file size, try reading the content
        const content = await this.file.text();
        const contentLength = content.length;
        const estimatedChunks = Math.ceil(
          contentLength / this.chunkSizeThreshold
        );
        return Math.max(1, estimatedChunks);
      }

      // Rough estimation: file size in bytes ≈ characters for text files
      // Add some buffer since chunking considers paragraph boundaries
      const estimatedChunks = Math.ceil(
        (fileSize * 1.2) / this.chunkSizeThreshold
      );
      return Math.max(1, estimatedChunks);
    } catch (error) {
      console.warn(`Could not estimate chunk count: ${error}`);
      return 1;
    }
  }

  /** Finish: flush remaining buffer, wait for facts to settle, return results. */
  finalize = async () => {
    await this.factAgent.waitForIdle();

    // Process any remaining facts
    await this.updateOutput();

    // Get final fact count
    const totalFacts = await this.getTotalFactCount();

    const accuracyInfo =
      this.estimatedChunks > 0 ? ` (estimated: ${this.estimatedChunks})` : "";
    console.log(
      `✅ Completed processing: ${this.chunkCounter} chunks processed${accuracyInfo}`
    );
    console.log(`🤖 Final model: ${this.factAgent.currentModel}`);
    console.log(`📊 Total facts extracted: ${totalFacts}`);
    console.log(`📁 Output directory: ${this.outputDir}`);
    console.log(`   ├── facts.jsonl`);
    console.log(`   ├── global_context.jsonl`);
    console.log(`   └── metadata.json`);

    // Mark as completed in metadata
    await this.markCompleted();

    return {
      context: this.factAgent.globalContext,
      currentContext: this.factAgent.currentContext,
      outputDir: this.outputDir,
      factsPath: this.factsPath,
      metadataPath: this.metadataPath,
    };
  };

  /** Mark processing as completed in metadata */
  private async markCompleted() {
    const metadata = {
      ...this.outputData.metadata,
      currentContext: this.factAgent.currentContext,
      totalChunks: this.chunkCounter,
      estimatedChunks: this.estimatedChunks,
      characterPosition: this.characterPosition,
      factsFile: "facts.jsonl",
      globalContextFile: "global_context.jsonl",
      status: "completed",
      completedAt: new Date().toISOString(),
      lastChunkProcessedAt: new Date().toISOString(),
    };

    await Bun.write(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  /** Load all facts from the JSONL file */
  private async loadAllFacts(): Promise<Fact[]> {
    try {
      const content = await Bun.file(this.factsPath).text();
      if (!content.trim()) return [];

      return content
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as Fact);
    } catch (error) {
      console.warn(`Could not load facts from ${this.factsPath}:`, error);
      return [];
    }
  }
}
