import { Triggers } from "convex-helpers/server/triggers";
import { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export const registerTriggers = (triggers: Triggers<DataModel>) => {
  triggers.register("documents", async (ctx, change) => {
    if (change.operation === "insert") {
      ctx.scheduler.runAfter(
        0,
        internal.operations.workflows.chunkDocument.startChunkDocument,
        {
          documentId: change.newDoc!._id,
        }
      );
    }

    if (
      change.operation === "update" &&
      change.newDoc?.statuses.some((status) => status.label === "chunked") &&
      !change.oldDoc?.statuses.some((status) => status.label === "chunked")
    ) {
      // Document just became "chunked" - start fact extraction
      console.log(
        `Document ${change.newDoc._id} finished chunking, starting fact extraction`
      );

      ctx.scheduler.runAfter(
        0,
        internal.operations.workflows.extractDocumentFacts
          .startExtractDocumentFacts,
        {
          documentId: change.newDoc._id,
        }
      );
    }
  });

  triggers.register("facts", async (ctx, change) => {
    if (change.operation === "insert") {
      /**
       * Start a workflow to send each fact from the chunk to graphiti using the scheduler to limit concurrency
       */
    }
  });
};
