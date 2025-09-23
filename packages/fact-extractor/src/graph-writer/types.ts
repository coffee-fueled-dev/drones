export interface GraphWriterConfig {
  chunksPath: string;
  metadataPath: string;
  graphitiUrl?: string;
  maxRetries?: number;
  batchSize?: number;
  enabled?: boolean;
}

// ChunkEpisode removed - GraphWriter now creates generic GraphitiEpisodes

export interface GraphWriterResult {
  chunksProcessed: number;
  episodesSent: number;
  errors: string[];
}
