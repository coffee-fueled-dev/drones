import { v } from "convex/values";
import { internalQuery, query } from "../../customFunctions";

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("document", documentId))
      .collect();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("chunks").collect();
  },
});

export const getById = internalQuery({
  args: {
    id: v.id("chunks"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listByDocumentOrdered = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("document", documentId))
      .collect();

    // Sort by cursor position to ensure sequential processing
    return chunks.sort((a, b) => a.cursor.position - b.cursor.position);
  },
});

export const getNextChunkByPosition = internalQuery({
  args: {
    documentId: v.id("documents"),
    startPosition: v.number(),
  },
  handler: async (ctx, { documentId, startPosition }) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("document", documentId))
      .collect();

    // Find the first chunk at or after the start position
    const nextChunk = chunks
      .filter((chunk) => chunk.cursor.position >= startPosition)
      .sort((a, b) => a.cursor.position - b.cursor.position)[0];

    return nextChunk || null;
  },
});
