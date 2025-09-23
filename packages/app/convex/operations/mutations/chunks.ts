import { v } from "convex/values";
import { internalMutation } from "../../customFunctions";

export const updateStatus = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    status: v.union(
      v.literal("pending"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("completed"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { chunkId, status, error }) => {
    console.log(`Updating chunk ${chunkId} status to: ${status}`);

    const chunk = await ctx.db.get(chunkId);
    if (!chunk) {
      console.error(`Chunk not found in updateStatus: ${chunkId}`);
      throw new Error("Chunk not found");
    }

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    try {
      await ctx.db.patch(chunkId, {
        updatedAt: now,
        completedAt:
          status === "completed" || status === "error"
            ? now
            : chunk.completedAt,
        error: error,
        statuses: [...chunk.statuses, newStatus],
      });
      console.log(`Successfully updated chunk status to: ${status}`);
    } catch (patchError) {
      console.error(`Error patching chunk:`, patchError);
      throw patchError;
    }
  },
});

export const updateContext = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    context: v.object({
      local: v.array(v.string()),
      recentGlobal: v.array(v.string()),
    }),
    factIds: v.array(v.string()),
  },
  handler: async (ctx, { chunkId, context, factIds }) => {
    console.log(`Updating chunk ${chunkId} context and facts`);

    const chunk = await ctx.db.get(chunkId);
    if (!chunk) {
      throw new Error("Chunk not found");
    }

    // Convert string fact IDs to proper IDs
    const factIdList = factIds.map((id) => id as any);

    await ctx.db.patch(chunkId, {
      updatedAt: Date.now(),
      context,
      facts: factIdList,
    });

    console.log(`Updated chunk ${chunkId} with ${factIds.length} facts`);
  },
});
