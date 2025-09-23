import { v } from "convex/values";
import { internalQuery, query } from "../../../../customFunctions";

export const listByDocument = query({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (ctx, { sourceId }) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_source", (q) => q.eq("source", sourceId))
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
