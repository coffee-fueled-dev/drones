import { v } from "convex/values";
import { workflow } from "../../../../workflow";
import { internal } from "../../../../_generated/api";
import { internalAction } from "../../../../customFunctions";
import { Id } from "../../../../_generated/dataModel";

export const run = internalAction({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (ctx, { sourceId }): Promise<void> => {
    console.log(`Starting fact extraction workflow for source: ${sourceId}`);

    const workflowId = await workflow.start(
      ctx,
      internal.knowledgeGraph.operations.source.workflows.extractSourceFacts
        .extractSourceFacts,
      {
        sourceId,
      }
    );

    try {
      while (true) {
        const status = await workflow.status(ctx, workflowId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 5000));
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

export const extractSourceFacts = workflow.define({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (step, { sourceId }): Promise<number> => {
    // Update source status to extracting
    await step.runMutation(
      internal.knowledgeGraph.operations.source.mutations.addStatus,
      {
        sourceId,
        status: "extracting",
      }
    );

    try {
      let totalFactsExtracted = 0;
      let currentPosition = 0;
      let previousChunkId: Id<"chunks"> | undefined = undefined;

      // Process chunks one at a time using cursor-based iteration
      while (true) {
        // Get the next chunk starting from current position
        const nextChunk = await step.runQuery(
          internal.knowledgeGraph.operations.source.queries.getNextChunk,
          {
            sourceId,
            startPosition: currentPosition,
          }
        );

        // If no more chunks, we're done
        if (!nextChunk) {
          break;
        }

        // Extract facts from this chunk - await completion for sequential processing
        await step.runAction(
          internal.knowledgeGraph.operations.source.chunk.workflows.analyzeChunk
            .run,
          {
            chunkId: nextChunk.id,
            previousChunkId: previousChunkId,
          },
          {
            name: `Extract facts from chunk at position ${nextChunk.cursor.position}`,
          }
        );

        // Update cursor for next iteration
        currentPosition = nextChunk.cursor.position + nextChunk.cursor.size;
        previousChunkId = nextChunk.id;
      }

      // Update source status to extracted
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.addStatus,
        {
          sourceId,
          status: "extracted",
        }
      );

      return totalFactsExtracted;
    } catch (error) {
      // Update source status to error
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.addStatus,
        {
          sourceId,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }
      );

      throw error;
    }
  },
});
