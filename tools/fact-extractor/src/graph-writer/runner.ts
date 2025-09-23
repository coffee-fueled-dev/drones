import Queue from "queue";
import { GraphWriter } from "./graph-writer";
import type { GraphWriterConfig, GraphWriterResult } from "./types";

export interface GraphRunnerConfig extends GraphWriterConfig {
  concurrency?: number;
  delayBetweenChunks?: number; // ms delay between processing chunks
}

export class GraphRunner extends GraphWriter {
  private runnerConfig: GraphRunnerConfig;
  private queue: Queue;

  constructor(config: GraphRunnerConfig) {
    const writerConfig = {
      concurrency: 1, // Sequential processing by default
      delayBetweenChunks: 200, // 200ms delay between chunks
      ...config,
    };

    super(writerConfig);
    this.runnerConfig = writerConfig;

    // Create queue with minimal concurrency to avoid overwhelming server
    this.queue = new Queue({
      concurrency: this.runnerConfig.concurrency,
      autostart: false, // We'll control when to start
    });
  }

  /**
   * Process all chunks from the chunks file to Graphiti
   */
  async run(): Promise<GraphWriterResult> {
    if (!this.config.enabled) {
      console.log(`[GraphRunner] Disabled, skipping Graphiti processing`);
      return {
        chunksProcessed: 0,
        episodesSent: 0,
        errors: [],
      };
    }

    console.log(
      `[GraphRunner] Starting sequential chunk processing to Graphiti`
    );

    // Check if Graphiti server is available (but continue anyway)
    const isAvailable = await this.isGraphitiAvailable();
    if (!isAvailable) {
      console.warn(
        `[GraphRunner] ⚠️  Could not verify Graphiti server at ${this.runnerConfig.graphitiUrl}`
      );
      console.warn(
        `[GraphRunner] 💡 Continuing anyway - individual episodes may fail if server is not running`
      );
    } else {
      console.log(`[GraphRunner] ✅ Graphiti server is available`);
    }

    // Load all chunks
    await this.reader.loadChunks();
    const { total } = this.getProgress();

    if (total === 0) {
      console.log(`[GraphRunner] No chunks found to process`);
      return {
        chunksProcessed: 0,
        episodesSent: 0,
        errors: [],
      };
    }

    console.log(`[GraphRunner] Found ${total} chunks to process`);

    const result: GraphWriterResult = {
      chunksProcessed: 0,
      episodesSent: 0,
      errors: [],
    };

    // Process chunks sequentially using queue
    await this.processChunksWithQueue(result);

    console.log(
      `[GraphRunner] Completed: ${result.episodesSent}/${total} episodes sent, ${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Process chunks starting from a specific chunk ID
   */
  async runFrom(chunkId: string): Promise<GraphWriterResult> {
    if (!this.config.enabled) {
      return { chunksProcessed: 0, episodesSent: 0, errors: [] };
    }

    console.log(`[GraphRunner] Starting from chunk ${chunkId}`);

    // Load chunks and seek to starting position
    await this.reader.loadChunks();

    if (!this.reader.seekToChunk(chunkId)) {
      throw new Error(`Chunk ${chunkId} not found`);
    }

    const { current, total } = this.getProgress();
    console.log(
      `[GraphRunner] Processing ${total - current} remaining chunks from position ${current}`
    );

    const result: GraphWriterResult = {
      chunksProcessed: 0,
      episodesSent: 0,
      errors: [],
    };

    await this.processChunksWithQueue(result);

    console.log(
      `[GraphRunner] Completed: ${result.episodesSent} episodes sent, ${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Process chunks using the queue for controlled concurrency
   */
  private async processChunksWithQueue(
    result: GraphWriterResult
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Process remaining chunks
      while (this.getProgress().hasMore) {
        const chunk = this.reader.nextChunk();

        if (!chunk) {
          break;
        }

        // Add chunk processing job to queue
        this.queue.push(async () => {
          try {
            const episode = await this.createEpisodeFromChunk(chunk);

            // Send episode to Graphiti (blocking - wait for response)
            await this.client.sendEpisode(episode);

            result.episodesSent++;
            result.chunksProcessed++;

            console.log(
              `[GraphRunner] Processed chunk ${chunk.chunkId} (${result.chunksProcessed}/${this.getTotalChunks()})`
            );

            // Add delay between chunks to avoid overwhelming the server
            if (
              this.runnerConfig.delayBetweenChunks &&
              this.runnerConfig.delayBetweenChunks > 0
            ) {
              await this.sleepMs(this.runnerConfig.delayBetweenChunks);
            }
          } catch (error) {
            const errorMsg = `Failed to process chunk ${chunk.chunkId}: ${error}`;
            console.error(`[GraphRunner] ${errorMsg}`);
            result.errors.push(errorMsg);
            result.chunksProcessed++;
          }
        });
      }

      // Handle queue completion
      this.queue.addEventListener("end", () => {
        resolve();
      });

      // Handle queue errors
      this.queue.addEventListener("error", (error) => {
        console.error(`[GraphRunner] Queue error:`, error);
        reject(error);
      });

      // Start processing
      this.queue.start();
    });
  }

  /**
   * Get total number of chunks loaded
   */
  private getTotalChunks(): number {
    return this.getProgress().total;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      length: this.queue.length,
      pending: (this.queue as any).pending,
      running: (this.queue as any).running,
    };
  }
}
