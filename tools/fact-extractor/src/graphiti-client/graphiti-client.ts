export interface GraphitiEpisode<T extends unknown = unknown> {
  content: T;
  name?: string;
  description?: string;
  reference_time?: string;
}

export interface GraphitiResponse {
  success: boolean;
  episode_id?: string;
  message?: string;
  error?: string;
}

export class GraphitiClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(
    baseUrl: string = "http://localhost:8000",
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ) {
    this.baseUrl = baseUrl;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  /**
   * Send an episode to the Graphiti server (non-blocking)
   * Returns immediately, doesn't wait for response
   */
  async sendEpisodeAsync(episode: GraphitiEpisode): Promise<void> {
    // Fire and forget - don't await the actual request
    this.sendEpisode(episode).catch((error) => {
      console.warn(`[Graphiti] Failed to send episode: ${error.message}`);
    });
  }

  /**
   * Send an episode to the Graphiti server (blocking)
   * Returns the response from the server
   */
  async sendEpisode(episode: GraphitiEpisode): Promise<GraphitiResponse> {
    return this.sendEpisodeWithRetry(episode, 0);
  }

  /**
   * Internal method to send episode with retry logic
   */
  private async sendEpisodeWithRetry(
    episode: GraphitiEpisode,
    attempt: number
  ): Promise<GraphitiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/episodes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(episode),
      });

      if (!response.ok) {
        // Handle rate limit errors specifically
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.calculateBackoffDelay(attempt);

          console.warn(
            `[Graphiti] Rate limited (429), retrying in ${delay}ms (attempt ${
              attempt + 1
            }/${this.maxRetries + 1})`
          );
          await this.sleep(delay);
          return this.sendEpisodeWithRetry(episode, attempt + 1);
        }

        // Handle other 5xx errors with retry
        if (response.status >= 500 && attempt < this.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(
            `[Graphiti] Server error (${
              response.status
            }), retrying in ${delay}ms (attempt ${attempt + 1}/${
              this.maxRetries + 1
            })`
          );
          await this.sleep(delay);
          return this.sendEpisodeWithRetry(episode, attempt + 1);
        }

        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as GraphitiResponse;
      return result;
    } catch (error) {
      // Retry on network errors
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(
          `[Graphiti] Network error, retrying in ${delay}ms (attempt ${
            attempt + 1
          }/${this.maxRetries + 1}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await this.sleep(delay);
        return this.sendEpisodeWithRetry(episode, attempt + 1);
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const jitter = Math.random() * 0.1; // Add 10% jitter
    return Math.floor(this.baseDelayMs * Math.pow(2, attempt) * (1 + jitter));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Retry on network errors, timeouts, etc.
      return (
        error.message.includes("fetch") ||
        error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("ECONNRESET") ||
        error.message.includes("ENOTFOUND")
      );
    }
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if the Graphiti server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: "GET",
        headers: { Accept: "application/json" },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      // Server is available if it responds (even with 404 for root path)
      // We're just checking if the server is reachable
      const isAvailable = response.status >= 200 && response.status < 500;

      if (!isAvailable) {
        console.warn(
          `[GraphitiClient] Server responded with status ${response.status}`
        );
      }

      return isAvailable;
    } catch (error) {
      console.warn(
        `[GraphitiClient] Server availability check failed:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  /**
   * Create a Graphiti episode
   */
  createEpisode<T extends unknown = unknown>(
    content: T,
    name?: string,
    description?: string,
    referenceTime?: string
  ): GraphitiEpisode {
    return {
      content,
      name: name || `episode_${new Date().toISOString()}`,
      description: description || "Generated episode",
      reference_time: referenceTime || new Date().toISOString(),
    };
  }
}
