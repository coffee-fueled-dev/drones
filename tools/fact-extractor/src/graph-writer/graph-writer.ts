import {
  GraphitiClient,
  type GraphitiEpisode,
} from "../graphiti-client/graphiti-client";
import { ChunkReader } from "./chunk-reader";
import { Encoder } from "../encoder";
import type { GraphWriterConfig, GraphWriterResult } from "./types";
import type { Chunk, ProcessMetadata } from "../document-processor";
import type { FactResponse } from "../agents/fact-extractor";
import { stringify as yamlStringify } from "json-to-pretty-yaml";

export class GraphWriter {
  protected client: GraphitiClient;
  protected reader: ChunkReader;
  protected config: GraphWriterConfig;
  private processMetadata?: ProcessMetadata;

  constructor(config: GraphWriterConfig) {
    this.config = {
      graphitiUrl: "http://localhost:8000",
      maxRetries: 3,
      batchSize: 10,
      enabled: true,
      ...config,
    };

    this.client = new GraphitiClient(
      this.config.graphitiUrl,
      this.config.maxRetries
    );

    this.reader = new ChunkReader(this.config.chunksPath);
  }

  /**
   * Process all chunks and send them to Graphiti
   */
  async processChunks(): Promise<GraphWriterResult> {
    if (!this.config.enabled) {
      console.log(`[GraphWriter] Disabled, skipping Graphiti integration`);
      return {
        chunksProcessed: 0,
        episodesSent: 0,
        errors: [],
      };
    }

    console.log(`[GraphWriter] Starting chunk processing to Graphiti`);

    // Check if Graphiti server is available
    const isAvailable = await this.client.isAvailable();
    if (!isAvailable) {
      const error = `Graphiti server not available at ${this.config.graphitiUrl}`;
      console.error(`[GraphWriter] ${error}`);
      return {
        chunksProcessed: 0,
        episodesSent: 0,
        errors: [error],
      };
    }

    // Load process metadata
    await this.loadProcessMetadata();

    // Load all chunks
    await this.reader.loadChunks();

    const result: GraphWriterResult = {
      chunksProcessed: 0,
      episodesSent: 0,
      errors: [],
    };

    const { total } = this.reader.getProgress();
    console.log(`[GraphWriter] Processing ${total} chunks`);

    // Process chunks in batches
    while (this.reader.getProgress().hasMore) {
      const batch = this.getBatch();

      for (const chunk of batch) {
        try {
          const episode = await this.createEpisodeFromChunk(chunk);

          // Send episode to Graphiti (non-blocking)
          await this.client.sendEpisodeAsync(episode);

          result.episodesSent++;
          console.log(`[GraphWriter] Sent episode for chunk ${chunk.chunkId}`);
        } catch (error) {
          const errorMsg = `Failed to process chunk ${chunk.chunkId}: ${error}`;
          console.error(`[GraphWriter] ${errorMsg}`);
          result.errors.push(errorMsg);
        }

        result.chunksProcessed++;
      }

      // Small delay between batches to avoid overwhelming the server
      if (this.reader.getProgress().hasMore) {
        await this.sleep(100);
      }
    }

    console.log(
      `[GraphWriter] Completed: ${result.episodesSent} episodes sent, ${result.errors.length} errors`
    );
    return result;
  }

  /**
   * Process chunks starting from a specific chunk ID
   */
  async processChunksFrom(chunkId: string): Promise<GraphWriterResult> {
    if (!this.config.enabled) {
      return { chunksProcessed: 0, episodesSent: 0, errors: [] };
    }

    await this.reader.loadChunks();

    if (!this.reader.seekToChunk(chunkId)) {
      throw new Error(`Chunk ${chunkId} not found`);
    }

    return this.processChunks();
  }

  /**
   * Get next batch of chunks
   */
  private getBatch(): Chunk[] {
    const batch: Chunk[] = [];

    for (
      let i = 0;
      i < this.config.batchSize! && this.reader.getProgress().hasMore;
      i++
    ) {
      const chunk = this.reader.nextChunk();
      if (chunk) {
        batch.push(chunk);
      }
    }

    return batch;
  }

  /**
   * Create a Graphiti episode from a chunk
   */
  protected async createEpisodeFromChunk(
    chunk: Chunk
  ): Promise<GraphitiEpisode> {
    // Decode the compressed data with proper typing
    const extraction = Encoder.decode<FactResponse>(chunk.hashes.extraction);
    const processMetadata = Encoder.decode<ProcessMetadata>(
      chunk.hashes.processMetadata
    );

    // Get document info from metadata
    const documentName =
      processMetadata.filename ||
      this.processMetadata?.filename ||
      "Unknown Document";
    const documentDescription =
      processMetadata.description ||
      this.processMetadata?.description ||
      `Document processing for ${processMetadata.filename || this.processMetadata?.filename || "unknown file"}`;

    const episodeName = `${documentName}_chunk_${chunk.chunkId}`;

    // Create human-readable summary
    const factCount = extraction.facts?.length || 0;
    const globalContext = extraction.globalContext || [];
    const currentContext = extraction.currentContext || [];

    let summary = `Chunk ID: ${chunk.chunkId}\n`;
    summary += `Document: ${documentName}\n`;
    summary += `Facts Extracted: ${factCount}\n`;
    summary += `Position: ${chunk.cursorPosition} (${chunk.chunkSize} chars)\n`;
    summary += `Processing Time: ${new Date(chunk.tsStart).toISOString()}\n`;

    if (globalContext.length > 0) {
      summary += `Global Context: ${globalContext.join(", ")}\n`;
    }

    if (currentContext.length > 0) {
      summary += `Current Context: ${currentContext.join(", ")}\n`;
    }

    if (factCount > 0) {
      summary += `\nKey Facts:\n`;
      extraction.facts.slice(0, 3).forEach((fact, i) => {
        summary += `${i + 1}. ${fact.subject} ${fact.predicate} ${fact.object}\n`;
      });

      if (factCount > 3) {
        summary += `... and ${factCount - 3} more facts\n`;
      }
    }

    // Convert complex objects to YAML for better Graphiti processing
    const extractionYaml = yamlStringify(extraction);
    const processMetadataYaml = yamlStringify(processMetadata);
    const contextYaml = yamlStringify(chunk.context);

    // Create episode content with YAML-formatted data
    const episodeContent = {
      summary,
      chunkId: chunk.chunkId,
      document: {
        // TODO: revert to getting from extraction -- hackathon override
        // name: documentName,
        // description: documentDescription,
        name: "Normalizing Unmanned Aircraft Systems Beyond Visual Line of Sight Operations",
        description:
          "Notice of Proposed Rulemaking for Beyond Visual Line of Sight operations of Unmanned Aircraft Systems, focusing on performance-based regulations for low-altitude UAS operations.",
      },
      extraction: extractionYaml,
      processMetadata: processMetadataYaml,
      context: contextYaml,
      chunkInfo: {
        cursorPosition: chunk.cursorPosition,
        chunkSize: chunk.chunkSize,
        processingDuration: chunk.tsEnd - chunk.tsStart,
        processedAt: new Date(chunk.tsStart).toISOString(),
      },
    };

    return this.client.createEpisode(
      episodeContent,
      episodeName,
      documentDescription,
      new Date(chunk.tsStart).toISOString()
    );
  }

  /**
   * Load process metadata from the metadata file
   */
  private async loadProcessMetadata(): Promise<void> {
    try {
      const metadataFile = Bun.file(this.config.metadataPath);

      if (await metadataFile.exists()) {
        this.processMetadata = (await metadataFile.json()) as ProcessMetadata;
        console.log(
          `[GraphWriter] Loaded metadata for process ${this.processMetadata.processId}`
        );
      } else {
        console.warn(
          `[GraphWriter] Metadata file not found: ${this.config.metadataPath}`
        );
      }
    } catch (error) {
      console.warn(`[GraphWriter] Failed to load metadata: ${error}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get information about the current processing state
   */
  getProgress() {
    return this.reader.getProgress();
  }

  /**
   * Check if Graphiti server is available
   */
  async isGraphitiAvailable(): Promise<boolean> {
    return this.client.isAvailable();
  }
}
