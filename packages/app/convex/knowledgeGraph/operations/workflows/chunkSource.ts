import { v } from "convex/values";
import { workflow } from "../../../workflow";
import { internal } from "../../../_generated/api";
import { internalAction } from "../../../customFunctions";

export const run = internalAction({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (ctx, { sourceId }): Promise<void> => {
    console.log(`Starting chunk workflow for source: ${sourceId}`);

    const workflowId = await workflow.start(
      ctx,
      internal.knowledgeGraph.operations.workflows.chunkSource.chunkSource,
      {
        sourceId,
      }
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

export const chunkSource = workflow.define({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (step, { sourceId }): Promise<number> => {
    console.log(`Chunk workflow starting for source: ${sourceId}`);

    const source = await step.runQuery(
      internal.knowledgeGraph.operations.source.queries.getById,
      {
        id: sourceId,
      }
    );

    if (!source) {
      console.error(`Document not found: ${sourceId}`);
      throw new Error("Document not found");
    }

    console.log(`Document found:`, source.name);

    try {
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.updateStatus,
        {
          sourceId,
          status: "chunking",
        }
      );

      const totalChunks = await step.runAction(
        internal.knowledgeGraph.operations.source.actions.chunk,
        {
          sourceId,
          storageId: source.storageId,
        }
      );
      console.log(
        `Chunk processing completed. Total chunks created: ${totalChunks}`
      );

      console.log(`Updating status to 'chunked'`);
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.updateStatus,
        {
          sourceId,
          status: "chunked",
        }
      );
      console.log(`Source status updated to 'chunked'`);

      return totalChunks;
    } catch (error) {
      console.error(`Error in chunk workflow:`, error);
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
