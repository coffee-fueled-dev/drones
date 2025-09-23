import { v } from "convex/values";
import z from "zod";
import { internalAction } from "../../_generated/server";
import { OperatorAgent } from "../agents/operator";

export const streamAsync = internalAction({
  args: {
    promptMessageId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { promptMessageId, threadId }) => {
    const { thread } = await OperatorAgent.continueThread(ctx, {
      threadId,
    });
    const result = await thread.streamText(
      { promptMessageId },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } }
    );
    // We need to make sure the stream finishes - by awaiting each chunk
    // or using this call to consume it all.
    await result.consumeStream();
  },
});

export const updateThreadTitle = internalAction({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const { thread } = await OperatorAgent.continueThread(ctx, { threadId });
    const {
      object: { title, summary },
    } = await thread.generateObject(
      {
        mode: "json",
        schemaDescription:
          "Generate a title and summary for the thread. The title should be a three word sentence that captures the main topic of the thread. " +
          "The summary should be a short description of the thread that could be used to describe it to someone who hasn't read it.",
        schema: z.object({
          title: z.string().describe("A three word title for the thread"),
          summary: z.string().describe("The new summary for the thread"),
        }),
        prompt: "Generate a title and summary for this thread.",
      },
      { storageOptions: { saveMessages: "none" } }
    );

    await thread.updateMetadata({ title, summary });
  },
});
