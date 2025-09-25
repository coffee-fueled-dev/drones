import { v } from "convex/values";
import { workflow } from "../../../../../workflow";
import { internal } from "../../../../../_generated/api";
import { Id } from "../../../../../_generated/dataModel";
import { internalAction } from "../../../../../customFunctions";

export const run = internalAction({
  args: {
    chunkId: v.id("chunks"),
    previousChunkId: v.optional(v.id("chunks")),
  },
  handler: async (ctx, { chunkId, previousChunkId }) => {
    console.log(`Analyzing chunk: ${chunkId}`);

    const workflowId = await workflow.start(
      ctx,
      internal.knowledgeGraph.operations.source.chunk.workflows.analyzeChunk
        .analyzeChunk,
      { chunkId, previousChunkId }
    );

    try {
      while (true) {
        const status = await workflow.status(ctx, workflowId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        console.log("Workflow completed with status:", status);
        break;
      }
    } finally {
      await workflow.cleanup(ctx, workflowId);
    }
  },
});

export const analyzeChunk = workflow.define({
  args: {
    chunkId: v.id("chunks"),
    previousChunkId: v.optional(v.id("chunks")),
  },
  handler: async (step, { chunkId, previousChunkId }) => {
    // Step 1: Get chunk data and context
    const chunk = await step.runQuery(
      internal.knowledgeGraph.operations.source.chunk.queries.getById,
      { id: chunkId }
    );

    if (!chunk) {
      throw new Error(`Chunk not found: ${chunkId}`);
    }

    let globalContext: string[] = [];
    let currentContext: string[] = [];

    if (previousChunkId) {
      console.log(`Getting context from previous chunk: ${previousChunkId}`);
      const previousChunk = await step.runQuery(
        internal.knowledgeGraph.operations.source.chunk.queries.getById,
        { id: previousChunkId }
      );

      if (previousChunk?.context) {
        globalContext = (previousChunk.context.recentGlobal || []).slice(-5);
        currentContext = previousChunk.context.local || [];
      }
    }

    // Step 2: Update status to extracting
    await step.runMutation(
      internal.knowledgeGraph.operations.source.chunk.mutations.addStatus,
      {
        chunkId,
        status: "extracting",
      }
    );

    // Step 3: Extract facts using AI
    const factResponse = await step.runAction(
      internal.knowledgeGraph.operations.source.chunk.actions.facts,
      {
        content: chunk.content!,
        globalContext,
        currentContext,
      },
      {
        retry: {
          maxAttempts: 3,
          base: 2,
          initialBackoffMs: 1000,
        },
      }
    );

    // Step 4: Save facts to database
    const factIds: Id<"facts">[] = [];
    for (const fact of factResponse.facts) {
      const factId = await step.runMutation(
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

    // Step 5: Update chunk with context and facts
    await step.runMutation(
      internal.knowledgeGraph.operations.source.chunk.mutations.updateContext,
      {
        chunkId,
        context: {
          local: factResponse.currentContext,
          recentGlobal: [...globalContext, ...factResponse.globalContext].slice(
            -5
          ),
        },
        factIds,
      }
    );

    // Step 6: Update status to extracted
    await step.runMutation(
      internal.knowledgeGraph.operations.source.chunk.mutations.addStatus,
      {
        chunkId,
        status: "extracted",
      }
    );

    console.log(`Successfully completed workflow for chunk: ${chunkId}`);
    return factIds.length;
  },
});
