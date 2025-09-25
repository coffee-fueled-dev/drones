import { v } from "convex/values";
import { internalQuery } from "../../../customFunctions";

export const getById = internalQuery({
  args: {
    id: v.id("sources"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getStorageUrl = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const getNextChunk = internalQuery({
  args: {
    sourceId: v.id("sources"),
    startPosition: v.number(),
  },
  handler: async (ctx, { sourceId, startPosition }) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_source", (q) => q.eq("source", sourceId))
      .collect();

    // Find the first chunk at or after the start position
    const nextChunk = chunks
      .filter((chunk) => chunk.cursor.position >= startPosition)
      .sort((a, b) => a.cursor.position - b.cursor.position)[0];

    if (!nextChunk) {
      return null;
    }

    return { id: nextChunk._id, cursor: nextChunk.cursor };
  },
});
