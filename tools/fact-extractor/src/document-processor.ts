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
  globalContext: string[];
}

export class DocumentProcessor {
  private factsPath: string;
  private metadataPath: string;
  private outputDir: string;
  private outputData: OutputData;
  private chunkCounter = 0;
  private estimatedChunks = 0;
  private graphitiClient?: GraphitiClient;
  private graphitiAvailable = false;
  private factsFileHandle?: Bun.BunFile;

  constructor(
    private readonly factAgent: FactExtractionAgent,
    private readonly file: Bun.BunFile,
    private readonly chunkSizeThreshold: number = 2000,
    private readonly enableGraphiti: boolean = false
  ) {
    const filename = path.basename(file.name || "unknown.txt");
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const sourceDir = path.dirname(file.name || ".");

    // Create a folder named after the source file
    this.outputDir = path.join(sourceDir, baseName);

    // Create separate files within the folder
    this.factsPath = path.join(this.outputDir, "facts.jsonl");
    this.metadataPath = path.join(this.outputDir, "metadata.json");

    this.outputData = {
      metadata: {
        filename,
        filepath: file.name || "",
        processedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        chunkSizeThreshold: this.chunkSizeThreshold,
      },
      globalContext: [],
    };

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
  processChunk = async (para: string) => {
    this.chunkCounter++;
    await this.factAgent.extract(para);
    await this.updateOutput();
  };

  /** Update output file with latest facts and context */
  private async updateOutput() {
    this.outputData.globalContext = this.factAgent.globalContext;

    // Get new facts since last update (this prevents unbounded accumulation)
    const newFacts = this.factAgent.flushFacts();
    this.outputData.metadata.lastUpdated = new Date().toISOString();

    const progressInfo =
      this.estimatedChunks > 0
        ? ` (${this.chunkCounter}/${this.estimatedChunks})`
        : "";

    // Append new facts to the JSONL file
    if (newFacts.length > 0) {
      await this.appendFacts(newFacts, this.factAgent.currentContext);
    }

    // Get total fact count for logging
    const totalFacts = await this.getTotalFactCount();

    console.log(
      `[${new Date(Date.now()).toLocaleTimeString()}] Chunk ${
        this.chunkCounter
      }${progressInfo}: ${totalFacts} total facts (+${newFacts.length} new)`
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

    // Clear facts file (start fresh)
    await Bun.write(this.factsPath, "");

    // Write initial metadata
    await this.updateMetadata();
  }

  /** Append new facts to the JSONL facts file */
  private async appendFacts(facts: Fact[], currentContext: string[]) {
    if (facts.length === 0) return;

    // Convert facts to JSONL format (one JSON object per line)
    const jsonlLines =
      facts
        .map((fact) => JSON.stringify({ ...fact, currentContext }))
        .join("\n") + "\n";

    // Append to the facts file
    const file = Bun.file(this.factsPath);
    const existingContent = await file.text();
    await Bun.write(this.factsPath, existingContent + jsonlLines);
  }

  /** Update the metadata file */
  private async updateMetadata() {
    const metadata = {
      ...this.outputData.metadata,
      globalContext: this.outputData.globalContext,
      currentContext: this.factAgent.currentContext,
      totalChunks: this.chunkCounter,
      estimatedChunks: this.estimatedChunks,
      factsFile: "facts.jsonl",
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
      globalContext: this.outputData.globalContext,
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
    console.log(`   ├── metadata.json`);

    return {
      context: this.factAgent.globalContext,
      currentContext: this.factAgent.currentContext,
      outputDir: this.outputDir,
      factsPath: this.factsPath,
      metadataPath: this.metadataPath,
    };
  };

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
