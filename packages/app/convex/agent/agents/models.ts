import type { EmbeddingModel, LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";

let chat: LanguageModel;
let textEmbedding: EmbeddingModel<string>;

if (process.env.OPENAI_API_KEY) {
  chat = openai.chat("gpt-4o-mini");
  textEmbedding = openai.textEmbeddingModel("text-embedding-3-small");
} else {
  throw new Error(
    "Run `npx convex env set OPENAI_API_KEY=<your-api-key>` to set the API key."
  );
}

export { chat, textEmbedding };
