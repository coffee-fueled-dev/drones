import { v } from "convex/values";
import { internalQuery } from "../../customFunctions";

export const getById = internalQuery({
  args: {
    id: v.id("documents"),
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
