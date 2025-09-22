import { zodTextFormat } from "openai/helpers/zod.mjs";
import z from "zod";
import { FileAgent } from "./file-agent";
import Queue from "queue";
import type OpenAI from "openai";

export type Fact = z.infer<typeof FactSchema>;
export const FactSchema = z.object({
  subject: z
    .string()
    .describe(
      "The subject of the fact. The subject should be the acting entity with regard to the fact."
    ),
  predicate: z
    .string()
    .describe(
      "The predicate of the fact. The predicate should be the action that is being performed by the subject on the object."
    ),
  object: z
    .string()
    .describe(
      "The object of the fact. The object should be the entity affected by the fact."
    ),
  source: z
    .string()
    .describe(
      "A pointer to the specific source in the document of the fact. " +
        "A reader should be able to locate the fact in the original document using this pointer. " +
        "A good pointer would be a legitimate reference to a section, article, line, or other specific part of the document."
    ),
});

export type FactResponse = z.infer<typeof FactResponseSchema>;
export const FactResponseSchema = z.object({
  globalContext: z
    .array(z.string())
    .describe(
      "Anything that needs to be added to global context about the document you're processing." +
        "Something should be added to global context when it is necessary to understand subsequent portions of the document." +
        "For example:" +
        "\nThe document title should be added to global context." +
        "\nThe document purpose should be added to global context." +
        "\nAny of your own insights about the document content should be added to global context" +
        "\nWhen something is added to global context, it should be understandable in the global sense -- meaning outside of the context of the current document chun or frame of referencek."
    ),
  facts: z
    .array(FactSchema)
    .describe(
      "A list of facts extracted from the last section of content provided to you. " +
        "A fact should contain one subject, one object, and one verb. " +
        "Each fact should be one cohesive triplet. " +
        "Use as many facts as necessary to convey the entirety of the content provided to you."
    ),
});

const models: OpenAI.ResponsesModel[] = [
  "gpt-4.1-nano",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4o-mini",
  "gpt-5-mini",
] as const;

export class FactExtractionAgent extends FileAgent {
  private readonly _context: string[] = [];
  private readonly _facts: Fact[] = [];
  private _currentModelIndex = 0;
  private readonly _maxContextSize = 10; // Limit context to last 10 entries
  private readonly _maxFactsInMemory = 1000; // Flush facts when we hit this limit

  // Ensure single-file serialization of extractions
  private readonly _extractionQ = new Queue({
    concurrency: 1,
    autostart: true,
  });

  extract = async (chunk: string) =>
    new Promise<void>((resolve, reject) => {
      this._extractionQ.push(async (cb?: () => void) => {
        try {
          if (!this._conversation)
            throw new Error("No conversation initialized");

          // Try extraction with model rotation for rate limit handling
          await this.extractWithModelRotation(chunk);
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          cb?.();
        }
      });
    });

  /**
   * Extract facts with automatic model rotation on rate limits
   */
  private async extractWithModelRotation(chunk: string): Promise<void> {
    if (!this._conversation) throw new Error("No conversation initialized");

    let lastError: Error | null = null;

    // Try each model in sequence when rate limited
    for (let attempt = 0; attempt < models.length; attempt++) {
      const modelIndex = (this._currentModelIndex + attempt) % models.length;
      const model = models[modelIndex];

      try {
        console.log(
          `[FactExtractor] Using model: ${model} (attempt ${attempt + 1}/${
            models.length
          })`
        );

        const contextEntries =
          this._context.length > 5 ? 5 : this._context.length;

        const context = this._context
          .slice(this._context.length - contextEntries)
          .join("\n");

        const response = await this._openai.responses.parse({
          model,
          conversation: this._conversation.id,
          input: [
            {
              role: "system",
              content:
                "You extract facts from document parts, adding anything necessary to understand the facts to global contex and attributing facts to specific document part that can be cited laters ." +
                "You must carefully attribute each fact to a citable reference in the source document.",
            },
            {
              role: "assistant",
              content:
                "DOCUMENT CONTEXT:\n\n" +
                (context.length ? context : "No additional information"),
            },
            { role: "user", content: chunk },
          ],
          text: {
            format: zodTextFormat(FactResponseSchema, "fact_extraction"),
          },
        });

        const out = response.output_parsed;
        if (out?.globalContext?.length) {
          this._context.push(...out.globalContext);
          // Trim context to prevent memory leak
          this.trimContext();
        }
        if (out?.facts?.length) {
          this._facts.push(...out.facts);
          // Check if we need to alert about memory usage
          this.checkMemoryUsage();
        }

        // Success! Update current model for next time and return
        this._currentModelIndex = modelIndex;
        console.log(`[FactExtractor] ✅ Success with model: ${model}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is a rate limit error
        if (this.isRateLimitError(error)) {
          console.warn(
            `[FactExtractor] ⚠️ Rate limited on model ${model}, trying next model...`
          );

          // Add a small delay before trying next model
          if (attempt < models.length - 1) {
            await this.sleep(500 + attempt * 200); // 500ms, 700ms, 900ms...
          }
          continue;
        }

        // For non-rate-limit errors, fail immediately
        console.error(`[FactExtractor] ❌ Error with model ${model}:`, error);
        throw error;
      }
    }

    // If we get here, all models failed with rate limits
    console.error(`[FactExtractor] ❌ All models rate limited, giving up`);
    throw new Error(
      `All available models are rate limited. Last error: ${lastError?.message}`
    );
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("429") ||
        message.includes("rate limit") ||
        message.includes("quota") ||
        message.includes("too many requests")
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
   * Trim context to prevent unbounded memory growth
   */
  private trimContext(): void {
    if (this._context.length > this._maxContextSize) {
      const removed = this._context.splice(
        0,
        this._context.length - this._maxContextSize
      );
      console.log(
        `[FactExtractor] 🧹 Trimmed ${removed.length} old context entries (keeping last ${this._maxContextSize})`
      );
    }
  }

  /**
   * Check memory usage and warn if facts are accumulating too much
   */
  private checkMemoryUsage(): void {
    if (this._facts.length > this._maxFactsInMemory) {
      console.warn(
        `[FactExtractor] ⚠️ Memory warning: ${this._facts.length} facts in memory. Consider calling flushFacts() more frequently.`
      );
    }
  }

  /** Wait until all queued extractions finish (use before flushing facts). */
  waitForIdle = async () =>
    new Promise<void>((resolve) => {
      // If queue is already drained
      if (
        this._extractionQ.length === 0 &&
        (this._extractionQ as any).running === 0
      ) {
        resolve();
      } else {
        // Add a one-time event handler
        const handler = () => {
          this._extractionQ.removeEventListener("end", handler);
          resolve();
        };
        this._extractionQ.addEventListener("end", handler);
      }
    });

  /** Drain and return all accumulated facts. */
  flushFacts = () => this._facts.splice(0);

  /** Get all accumulated facts without draining them. */
  getAllFacts = () => [...this._facts];

  get context() {
    return [...this._context];
  }

  /** Get the currently selected model */
  get currentModel(): string {
    return models[this._currentModelIndex];
  }

  /** Get all available models */
  get availableModels(): readonly string[] {
    return models;
  }
}
