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
    .nullable()
    .describe(
      "Attribute the fact to a specific location in the document, a table, a page, a figure, a section, etc."
    ),
});

export type FactResponse = z.infer<typeof FactResponseSchema>;
export const FactResponseSchema = z.object({
  globalContext: z
    .array(z.string())
    .max(3)
    .describe(
      "Anything that needs to be added to global context about the document you're processing." +
        "Something should be added to global context when it is necessary to understand subsequent portions of the document." +
        "For example:" +
        "\nThe document title should be added to global context." +
        "\nThe document purpose should be added to global context." +
        "\nAny of your own insights about the document content should be added to global context" +
        "\nWhen something is added to global context, it should be understandable in the global sense -- meaning outside of the context of the current document chun or frame of referencek."
    ),
  currentContext: z
    .array(z.string())
    .max(2)
    .describe(
      "The current context of the document you're processing. " +
        "Use the current context for locating facts within the document as a whole. " +
        "Current context should be a list of two phrases. One, like 'I am currently reading about...' AND another, like 'This is continuing the previous context of...'"
    ),
  facts: z
    .array(FactSchema)
    .min(3)
    .max(10)
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
  private readonly _globalContext: string[] = [];
  private readonly _currentContext: string[] = [];
  private readonly _facts: Fact[] = [];
  private _currentModelIndex = 0;
  private readonly _maxContextSize = 6; // Reduced to keep prompts smaller
  private readonly _maxFactsInMemory = 1000; // Flush facts when we hit this limit
  private readonly _extractionTimeout: number; // Timeout for extraction in milliseconds

  constructor(extractionTimeoutMs: number = 60000) {
    super();
    this._extractionTimeout = extractionTimeoutMs;
  }

  // Ensure single-file serialization of extractions
  private readonly _extractionQ = new Queue({
    concurrency: 1,
    autostart: true,
  });

  extract = async (chunk: string) =>
    new Promise<void>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Extraction timed out after ${this._extractionTimeout}ms`)
        );
      }, this._extractionTimeout);

      this._extractionQ.push(async (cb?: () => void) => {
        try {
          // Try extraction with model rotation for rate limit handling
          await this.extractWithModelRotation(chunk);
          clearTimeout(timeoutId);
          resolve();
        } catch (e) {
          clearTimeout(timeoutId);
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

        // Use only the last 3 context entries to keep prompts smaller
        const contextEntries =
          this._globalContext.length > 3 ? 3 : this._globalContext.length;

        const context = this._globalContext
          .slice(this._globalContext.length - contextEntries)
          .join("\n");

        // Log request size for debugging
        const totalPromptLength =
          chunk.length + context.length + this._currentContext.join("").length;
        console.log(
          `[FactExtractor] 📏 Request size: chunk=${chunk.length} chars, context=${context.length} chars, total≈${totalPromptLength} chars`
        );

        const response = await this._openai.responses.parse({
          model,
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
            {
              role: "assistant",
              content:
                "CURRENT CONTEXT:\n\n" +
                (this._currentContext.length
                  ? this._currentContext
                  : "No additional information"),
            },
            { role: "user", content: chunk },
          ],
          text: {
            format: zodTextFormat(FactResponseSchema, "fact_extraction"),
          },
        });

        const out = response.output_parsed;
        if (out?.globalContext?.length) {
          const beforeLength = this._globalContext.length;
          this._globalContext.push(...out.globalContext);
          // Trim global context to prevent unbounded growth
          this.trimGlobalContext();
          console.log(
            `[FactExtractor] 📝 Added ${out.globalContext.length} context entries (${beforeLength} → ${this._globalContext.length})`
          );
        }
        if (out?.currentContext?.length) {
          this._currentContext.splice(
            0,
            this._currentContext.length - 1,
            ...out.currentContext
          );
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

        // Check if this is a timeout error - don't retry different models for timeouts
        if (this.isTimeoutError(error)) {
          console.error(
            `[FactExtractor] ⏰ Timeout on model ${model} after ${this._extractionTimeout}ms`
          );
          throw error;
        }

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

        // For other non-rate-limit errors, fail immediately
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
   * Check if error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes("timed out");
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
   * Trim global context to prevent unbounded memory growth
   */
  private trimGlobalContext(): void {
    if (this._globalContext.length > this._maxContextSize) {
      const removed = this._globalContext.splice(
        0,
        this._globalContext.length - this._maxContextSize
      );
      console.log(
        `[FactExtractor] 🧹 Trimmed ${removed.length} old global context entries (keeping last ${this._maxContextSize})`
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

  get globalContext() {
    return [...this._globalContext];
  }

  get currentContext() {
    return [...this._currentContext];
  }

  /** Restore global context when resuming processing */
  restoreGlobalContext(existingContext: string[]) {
    this._globalContext.splice(
      0,
      this._globalContext.length,
      ...existingContext
    );
    console.log(
      `[FactExtractor] 🔄 Restored ${existingContext.length} global context entries`
    );
  }

  /** Get the currently selected model */
  get currentModel(): string {
    return models[this._currentModelIndex];
  }

  /** Get all available models */
  get availableModels(): readonly string[] {
    return models;
  }

  /** Get current extraction timeout in milliseconds */
  get extractionTimeout(): number {
    return this._extractionTimeout;
  }
}
