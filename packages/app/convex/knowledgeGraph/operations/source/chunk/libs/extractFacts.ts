import { zodTextFormat } from "openai/helpers/zod.mjs";
import z from "zod";
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

export interface ExtractFactsOptions {
  openai: OpenAI;
  chunk: string;
  globalContext?: string[];
  currentContext?: string[];
  timeoutMs?: number;
}

/**
 * Extract facts from a document chunk using OpenAI
 */
export async function extractFacts({
  openai,
  chunk,
  globalContext = [],
  currentContext = [],
  timeoutMs = 60000,
}: ExtractFactsOptions): Promise<FactResponse | null> {
  // Use only the last 5 context entries maximum to prevent unbounded growth
  const contextEntries = Math.min(globalContext.length, 5);
  const context = globalContext.slice(-contextEntries).join("\n");

  let lastError: Error | null = null;

  // Try each model in sequence when rate limited
  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Extraction timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Create extraction promise
      const extractionPromise = openai.responses.parse({
        model,
        input: [
          {
            role: "system",
            content:
              "You extract facts from document parts, adding anything necessary to understand the facts to global context and attributing facts to specific document parts that can be cited later. " +
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
              (currentContext.length
                ? currentContext.join("\n")
                : "No additional information"),
          },
          { role: "user", content: chunk },
        ],
        text: {
          format: zodTextFormat(FactResponseSchema, "fact_extraction"),
        },
      });

      // Race between extraction and timeout
      const response = await Promise.race([extractionPromise, timeoutPromise]);

      return response.output_parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a timeout error - don't retry different models for timeouts
      if (isTimeoutError(error)) {
        throw error;
      }

      // Check if this is a rate limit error
      if (isRateLimitError(error)) {
        // Add a small delay before trying next model
        if (attempt < models.length - 1) {
          await sleep(500 + attempt * 200); // 500ms, 700ms, 900ms...
        }
        continue;
      }

      // For other non-rate-limit errors, fail immediately
      throw error;
    }
  }

  // If we get here, all models failed with rate limits
  throw new Error(
    `All available models are rate limited. Last error: ${lastError?.message}`
  );
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
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
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("timed out");
  }
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
