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
    console.log(`Extract facts workflow starting for source: ${sourceId}`);

    // Update source status to extracting
    await step.runMutation(
      internal.knowledgeGraph.operations.source.mutations.updateStatus,
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
          console.log(`No more chunks found. Completed processing.`);
          break;
        }

        // Extract facts from this chunk - await completion for sequential processing
        const factsCount = await step.runAction(
          internal.knowledgeGraph.operations.source.chunk.actions.analyze,
          {
            chunkId: nextChunk._id,
            previousChunkId: previousChunkId,
          },
          {
            name: `Extract facts from chunk at position ${nextChunk.cursor.position}`,
          }
        );

        totalFactsExtracted += factsCount;

        // Update cursor for next iteration
        currentPosition = nextChunk.cursor.position + nextChunk.cursor.size;
        previousChunkId = nextChunk._id;
      }

      if (totalFactsExtracted === 0) {
        await step.runMutation(
          internal.knowledgeGraph.operations.source.mutations.updateStatus,
          {
            sourceId,
            status: "error",
            error: "No chunks found to extract facts from",
          }
        );
        return 0;
      }

      console.log(
        `Completed fact extraction for source ${sourceId}. Total facts: ${totalFactsExtracted}`
      );

      // Update source status to extracted
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.updateStatus,
        {
          sourceId,
          status: "extracted",
        }
      );

      return totalFactsExtracted;
    } catch (error) {
      console.error(`Error in fact extraction workflow:`, error);

      // Update source status to error
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.updateStatus,
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
