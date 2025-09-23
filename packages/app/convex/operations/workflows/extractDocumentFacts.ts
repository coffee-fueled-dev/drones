import { v } from "convex/values";
import { workflow } from "../../workflow";
import { internal } from "../../_generated/api";
import { internalAction } from "../../customFunctions";
import { Id } from "../../_generated/dataModel";

export const startExtractDocumentFacts = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }): Promise<void> => {
    console.log(
      `Starting fact extraction workflow for document: ${documentId}`
    );

    const workflowId = await workflow.start(
      ctx,
      internal.operations.workflows.extractDocumentFacts.extractDocumentFacts,
      {
        documentId,
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

export const extractDocumentFacts = workflow.define({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (step, { documentId }): Promise<number> => {
    console.log(`Extract facts workflow starting for document: ${documentId}`);

    // Update document status to extracting
    await step.runMutation(
      internal.operations.mutations.document.updateStatus,
      {
        documentId,
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
          internal.operations.queries.chunks.getNextChunkByPosition,
          {
            documentId,
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
          internal.operations.actions.factExtractor.processChunkFacts,
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
          internal.operations.mutations.document.updateStatus,
          {
            documentId,
            status: "error",
            error: "No chunks found to extract facts from",
          }
        );
        return 0;
      }

      console.log(
        `Completed fact extraction for document ${documentId}. Total facts: ${totalFactsExtracted}`
      );

      // Update document status to extracted
      await step.runMutation(
        internal.operations.mutations.document.updateStatus,
        {
          documentId,
          status: "extracted",
        }
      );

      return totalFactsExtracted;
    } catch (error) {
      console.error(`Error in fact extraction workflow:`, error);

      // Update document status to error
      await step.runMutation(
        internal.operations.mutations.document.updateStatus,
        {
          documentId,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }
      );

      throw error;
    }
  },
});
