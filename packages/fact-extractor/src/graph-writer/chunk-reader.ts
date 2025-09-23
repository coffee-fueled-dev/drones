import type { Chunk } from "../document-processor";

export class ChunkReader {
  private chunks: Chunk[] = [];
  private currentIndex = 0;
  private chunksPath: string;

  constructor(chunksPath: string) {
    this.chunksPath = chunksPath;
  }

  /**
   * Load all chunks from the JSONL file
   */
  async loadChunks(): Promise<void> {
    try {
      const file = Bun.file(this.chunksPath);

      if (!(await file.exists())) {
        console.warn(`[ChunkReader] Chunks file not found: ${this.chunksPath}`);
        return;
      }

      const content = await file.text();
      if (!content.trim()) {
        console.warn(`[ChunkReader] Chunks file is empty: ${this.chunksPath}`);
        return;
      }

      this.chunks = content
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line, index) => {
          try {
            return JSON.parse(line) as Chunk;
          } catch (error) {
            console.warn(
              `[ChunkReader] Failed to parse chunk at line ${index + 1}: ${error}`
            );
            return null;
          }
        })
        .filter((chunk): chunk is Chunk => chunk !== null);

      console.log(
        `[ChunkReader] Loaded ${this.chunks.length} chunks from ${this.chunksPath}`
      );
    } catch (error) {
      console.error(`[ChunkReader] Error loading chunks: ${error}`);
      throw error;
    }
  }

  /**
   * Get the next chunk in sequence
   */
  nextChunk(): Chunk | null {
    if (this.currentIndex >= this.chunks.length) {
      return null;
    }

    return this.chunks[this.currentIndex++];
  }

  /**
   * Get all remaining chunks
   */
  remainingChunks(): Chunk[] {
    const remaining = this.chunks.slice(this.currentIndex);
    this.currentIndex = this.chunks.length;
    return remaining;
  }

  /**
   * Reset to start reading from the beginning
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Get current position info
   */
  getProgress(): { current: number; total: number; hasMore: boolean } {
    return {
      current: this.currentIndex,
      total: this.chunks.length,
      hasMore: this.currentIndex < this.chunks.length,
    };
  }

  /**
   * Get chunks starting from a specific chunk ID
   */
  seekToChunk(chunkId: string): boolean {
    const index = this.chunks.findIndex((chunk) => chunk.chunkId === chunkId);
    if (index >= 0) {
      this.currentIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Get a specific chunk by ID
   */
  getChunkById(chunkId: string): Chunk | null {
    return this.chunks.find((chunk) => chunk.chunkId === chunkId) || null;
  }
}
