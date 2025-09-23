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
      createdAt: now,
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

export const updateStatus = internalMutation({
  args: {
    sourceId: v.id("sources"),
    status: SourceStatusSchema,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { sourceId, status, error }) => {
    console.log(`Updating source ${sourceId} status to: ${status}`);

    const source = await ctx.db.get(sourceId);
    if (!source) {
      console.error(`Source not found in updateStatus: ${sourceId}`);
      throw new Error("Source not found");
    }

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    try {
      await ctx.db.patch(sourceId, {
        updatedAt: now,
        completedAt:
          status === "completed" || status === "error"
            ? now
            : source.completedAt,
        error: error,
        statuses: [...source.statuses, newStatus],
      });
      console.log(`Successfully updated source status to: ${status}`);
    } catch (patchError) {
      console.error(`Error patching source:`, patchError);
      throw patchError;
    }
  },
});
