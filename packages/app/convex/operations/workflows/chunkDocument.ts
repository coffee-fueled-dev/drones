import { v } from "convex/values";
import { workflow } from "../../workflow";
import { internal } from "../../_generated/api";
import { internalAction } from "../../customFunctions";

export const startChunkDocument = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }): Promise<void> => {
    console.log(`Starting chunk workflow for document: ${documentId}`);

    const workflowId = await workflow.start(
      ctx,
      internal.operations.workflows.chunkDocument.chunk,
      {
        documentId,
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

export const chunk = workflow.define({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (step, { documentId }): Promise<number> => {
    console.log(`Chunk workflow starting for document: ${documentId}`);

    const document = await step.runQuery(
      internal.operations.queries.document.getById,
      {
        id: documentId,
      }
    );

    if (!document) {
      console.error(`Document not found: ${documentId}`);
      throw new Error("Document not found");
    }

    console.log(`Document found:`, document.name);

    try {
      await step.runMutation(
        internal.operations.mutations.document.updateStatus,
        {
          documentId,
          status: "chunking",
        }
      );

      const totalChunks = await step.runAction(
        internal.operations.actions.chunkProcessor.processDocumentChunks,
        {
          documentId,
          storageId: document.storageId,
        }
      );
      console.log(
        `Chunk processing completed. Total chunks created: ${totalChunks}`
      );

      // Update document status to chunked
      console.log(`Updating status to 'chunked'`);
      await step.runMutation(
        internal.operations.mutations.document.updateStatus,
        {
          documentId,
          status: "chunked",
        }
      );
      console.log(`Document status updated to 'chunked'`);

      return totalChunks;
    } catch (error) {
      // Update document status to error
      console.error(`Error in chunk workflow:`, error);
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
