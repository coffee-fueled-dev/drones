import { v } from "convex/values";
import { SourceStatusSchema } from "../../entities/source.domain";
import { SourceRepository } from "../../entities/source.repository";
import { internalMutation, mutation } from "../../../customFunctions";

export const create = mutation({
  args: {
    source: v.object({
      name: v.string(),
      description: v.string(),
      storageId: v.id("_storage"),
    }),
  },
  handler: async (ctx, { source }) => {
    const now = Date.now();
    const createdSource = await SourceRepository.create(ctx, {
      ...source,
      updatedAt: now,
      statuses: [
        {
          label: "pending",
          timestamp: now,
        },
      ],
    });

    if (!createdSource) {
      throw new Error("Source not created");
    }

    return createdSource._id;
  },
});

export const addStatus = internalMutation({
  args: {
    sourceId: v.id("sources"),
    status: SourceStatusSchema,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { sourceId, status, error }) => {
    console.log(`Updating source ${sourceId} status to: ${status}`);

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    try {
      const updatedSource = await SourceRepository.startTransaction(
        ctx,
        sourceId
      ).then((tx) => {
        tx.addStatus(newStatus);
        if (status === "completed" || status === "error") tx.setCompleted(now);
        if (error) tx.setError(error, now);
        return tx.commit();
      });

      console.log(`Successfully updated source status to: ${status}`);
      return updatedSource;
    } catch (patchError) {
      console.error(`Error updating source:`, patchError);
      throw patchError;
    }
  },
});
