import { internalAction } from "../../customFunctions";
import { v } from "convex/values";
import { ToolConfigSchema, Agents } from "../agents";
import { configureRuntimeTools } from "../tools/configureRuntimeTools";
import { GenericAgent } from "../agents/GenericAgent/agent";
import { googleGenAI } from "../../agent/agents/shared/models";
import z from "zod";

export const streamAsync = internalAction({
  args: {
    promptMessageId: v.string(),
    threadId: v.string(),
    toolConfig: v.optional(ToolConfigSchema),
  },
  handler: async (ctx, { promptMessageId, threadId, toolConfig }) => {
    const selectedAgentConfig = toolConfig ?? { agentName: "generic-agent" };

    const tools = configureRuntimeTools({
      ...selectedAgentConfig,
      messageId: promptMessageId,
      threadId,
    });

    const { thread } = await Agents[
      selectedAgentConfig.agentName
    ].continueThread(ctx, {
      threadId,
      tools,
    });
    const result = await thread.streamText(
      { promptMessageId },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
    );
    // We need to make sure the stream finishes - by awaiting each chunk
    // or using this call to consume it all.
    await result.consumeStream();
  },
});

export const updateThreadTitle = internalAction({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const { thread } = await GenericAgent.continueThread(ctx, { threadId });
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
      { storageOptions: { saveMessages: "none" } },
    );

    await thread.updateMetadata({ title, summary });
  },
});

export const generateTextDocument = internalAction({
  args: {
    instructions: v.string(),
  },
  handler: async (_ctx, { instructions }) => {
    try {
      const response = await googleGenAI.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [instructions],
        config: {
          responseJsonSchema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                minLength: 1,
                maxLength: 5000,
              },
            },
            required: ["content"],
          },
        },
      });

      if (!response.text) return undefined;

      return {
        content: response.text,
      };
    } catch {
      throw new Error("Invalid response from Google Gemini");
    }
  },
});
