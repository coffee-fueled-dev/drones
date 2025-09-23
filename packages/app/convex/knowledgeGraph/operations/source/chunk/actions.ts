import { v } from "convex/values";
import { extractFacts } from "./libs/extractFacts";
import OpenAI from "openai";
import { internalAction } from "../../../../customFunctions";
import { internal } from "../../../../_generated/api";

export const analyze = internalAction({
  args: {
    chunkId: v.id("chunks"),
    previousChunkId: v.optional(v.id("chunks")),
  },
  handler: async (ctx, { chunkId, previousChunkId }) => {
    console.log(`Processing facts for chunk: ${chunkId}`);

    // Get the current chunk
    const chunk = await ctx.runQuery(
      internal.knowledgeGraph.operations.source.chunk.queries.getById,
      {
        id: chunkId,
      }
    );

    if (!chunk) {
      throw new Error(`Chunk not found: ${chunkId}`);
    }

    // Get previous chunk context if available
    let globalContext: string[] = [];
    let currentContext: string[] = [];

    if (previousChunkId) {
      console.log(`Getting context from previous chunk: ${previousChunkId}`);
      const previousChunk = await ctx.runQuery(
        internal.knowledgeGraph.operations.source.chunk.queries.getById,
        {
          id: previousChunkId,
        }
      );

      if (previousChunk?.context) {
        // Only use the last 5 global context items to prevent unbounded growth
        globalContext = (previousChunk.context.recentGlobal || []).slice(-5);
        currentContext = previousChunk.context.local || [];
      }
    }

    console.log(
      `Context: ${globalContext.length} global, ${currentContext.length} current`
    );

    // Update chunk status to extracting
    await ctx.runMutation(
      internal.knowledgeGraph.operations.source.chunk.mutations.updateStatus,
      {
        chunkId,
        status: "extracting",
      }
    );

    try {
      // Extract facts using OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });

      const factResponse = await extractFacts({
        openai,
        chunk: chunk.content!,
        globalContext,
        currentContext,
        timeoutMs: 30000,
      });

      if (!factResponse) {
        throw new Error("No fact response from extractFacts");
      }

      console.log(
        `Extracted ${factResponse.facts.length} facts from chunk ${chunkId}`
      );

      // Save facts to database
      const factIds: string[] = [];
      for (const fact of factResponse.facts) {
        const factId = await ctx.runMutation(
          internal.knowledgeGraph.operations.source.chunk.fact.mutations.create,
          {
            chunkId,
            fact: {
              subject: fact.subject,
              predicate: fact.predicate,
              object: fact.object,
              source: fact.source,
            },
          }
        );
        factIds.push(factId);
      }

      // Update chunk with context and facts - keep only last 5 global context items
      const updatedGlobalContext = [
        ...globalContext,
        ...factResponse.globalContext,
      ].slice(-5);

      await ctx.runMutation(
        internal.knowledgeGraph.operations.source.chunk.mutations.updateContext,
        {
          chunkId,
          context: {
            local: factResponse.currentContext,
            recentGlobal: updatedGlobalContext,
          },
          factIds,
        }
      );

      // Update chunk status to extracted
      await ctx.runMutation(
        internal.knowledgeGraph.operations.source.chunk.mutations.updateStatus,
        {
          chunkId,
          status: "extracted",
        }
      );

      console.log(`Successfully processed facts for chunk: ${chunkId}`);
      return factIds.length;
    } catch (error) {
      console.error(`Error processing facts for chunk ${chunkId}:`, error);

      // Update chunk status to error
      await ctx.runMutation(
        internal.knowledgeGraph.operations.source.chunk.mutations.updateStatus,
        {
          chunkId,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }
      );

      throw error;
    }
  },
});
