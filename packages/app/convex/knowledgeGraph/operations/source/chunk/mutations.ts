import { v } from "convex/values";
import { internalMutation } from "../../../../customFunctions";
import { ChunkRepository } from "../../../entities/chunk.repository";

export const create = internalMutation({
  args: {
    sourceId: v.id("sources"),
    position: v.number(),
    size: v.number(),
    content: v.string(),
  },
  handler: async (ctx, { sourceId, position, size, content }) => {
    const now = Date.now();

    const chunkId = await ctx.db.insert("chunks", {
      updatedAt: now,
      source: sourceId,
      content: content,
      cursor: {
        position,
        size,
      },
      statuses: [
        {
          label: "pending",
          timestamp: now,
        },
      ],
    });

    return chunkId;
  },
});

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

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    try {
      const updatedChunk = await ChunkRepository.startTransaction(
        ctx,
        chunkId
      ).then((tx) => {
        tx.addStatus(newStatus);

        if (status === "completed" || status === "error") {
          tx.setCompleted(now);
        }

        if (error) {
          tx.setError(error, now);
        }

        return tx.commit();
      });

      console.log(`Successfully updated chunk status to: ${status}`);
      return updatedChunk;
    } catch (patchError) {
      console.error(`Error updating chunk:`, patchError);
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
    factIds: v.array(v.id("facts")),
  },
  handler: async (ctx, { chunkId, context, factIds }) => {
    console.log(`Updating chunk ${chunkId} context and facts`);

    const updatedChunk = await ChunkRepository.startTransaction(
      ctx,
      chunkId
    ).then(async (tx) => tx.setContext(context).setFacts(factIds).commit());

    console.log(`Updated chunk ${chunkId} with ${factIds.length} facts`);
    return updatedChunk;
  },
});
