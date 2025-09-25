import { v } from "convex/values";
import { extractFacts } from "./libs/extractFacts";
import OpenAI from "openai";
import { internalAction } from "../../../../customFunctions";

export const facts = internalAction({
  args: {
    content: v.string(),
    globalContext: v.array(v.string()),
    currentContext: v.array(v.string()),
  },
  handler: async (_ctx, { content, globalContext, currentContext }) => {
    console.log(`Extracting facts from content of length: ${content.length}`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const factResponse = await extractFacts({
      openai,
      chunk: content,
      globalContext,
      currentContext,
      timeoutMs: 30000,
    });

    if (!factResponse) {
      throw new Error("No fact response from extractFacts");
    }

    console.log(`Extracted ${factResponse.facts.length} facts`);
    return factResponse;
  },
});
