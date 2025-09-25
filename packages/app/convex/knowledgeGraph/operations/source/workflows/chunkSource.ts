import { v } from "convex/values";
import { workflow } from "../../../../workflow";
import { internal } from "../../../../_generated/api";
import { internalAction } from "../../../../customFunctions";

export const run = internalAction({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (ctx, { sourceId }): Promise<void> => {
    console.log(`Starting chunk workflow for source: ${sourceId}`);

    const workflowId = await workflow.start(
      ctx,
      internal.knowledgeGraph.operations.source.workflows.chunkSource
        .chunkSource,
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
    const source = await step.runQuery(
      internal.knowledgeGraph.operations.source.queries.getById,
      {
        id: sourceId,
      }
    );

    if (!source) {
      throw new Error(`Document not found: ${sourceId}`);
    }

    try {
      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.addStatus,
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

      await step.runMutation(
        internal.knowledgeGraph.operations.source.mutations.addStatus,
        {
          sourceId,
          status: "chunked",
        }
      );

      return totalChunks;
    } catch (error) {
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
