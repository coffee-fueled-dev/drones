import { zodTextFormat } from "openai/helpers/zod.mjs";
import z from "zod";
import { FileAgent } from "./file-agent";
import Queue from "queue";

export type Fact = z.infer<typeof FactSchema>;
export const FactSchema = z.object({
  subject: z.string().describe("The subject of the fact."),
  object: z.string().describe("The object of the fact."),
  verb: z.string().describe("The verb of the fact."),
  description: z
    .string()
    .nullable()
    .describe(
      "Optionally describe any context that is necessary to understand the fact."
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
        "A fact should contain one subject, one object, and one precidate. " +
        "Each fact should be one cohesive triplet. " +
        "Use as many facts as necessary to convey the entirety of the content provided to you."
    ),
});

export class FactExtractionAgent extends FileAgent {
  private readonly _context: string[] = [];
  private readonly _facts: Fact[] = [];

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

          const response = await this._openai.responses.parse({
            model: "gpt-5-nano",
            conversation: this._conversation.id,
            input: [
              {
                role: "system",
                content: "You extract facts from document parts.",
              },
              {
                role: "assistant",
                content:
                  "DOCUMENT CONTEXT:\n\n" +
                  (this._context.length
                    ? this._context.join("\n")
                    : "No additional information"),
              },
              { role: "user", content: chunk },
            ],
            text: {
              format: zodTextFormat(FactResponseSchema, "fact_extraction"),
            },
          });

          const out = response.output_parsed;
          if (out?.globalContext?.length)
            this._context.push(...out.globalContext);
          if (out?.facts?.length) this._facts.push(...out.facts);
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          cb?.();
        }
      });
    });

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
}
