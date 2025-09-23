import { v } from "convex/values";
import { internalMutation } from "../../customFunctions";

export const create = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    fact: v.object({
      subject: v.string(),
      predicate: v.string(),
      object: v.string(),
      source: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { chunkId, fact }) => {
    const now = Date.now();

    const factId = await ctx.db.insert("facts", {
      createdAt: now,
      updatedAt: now,
      chunk: chunkId,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      source: fact.source,
      statuses: [
        {
          label: "extracted",
          timestamp: now,
        },
      ],
    });

    console.log(`Created fact: ${factId}`);
    return factId;
  },
});

export const updateStatus = internalMutation({
  args: {
    factId: v.id("facts"),
    status: v.union(
      v.literal("extracted"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("completed"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { factId, status, error }) => {
    const fact = await ctx.db.get(factId);
    if (!fact) {
      throw new Error("Fact not found");
    }

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    await ctx.db.patch(factId, {
      updatedAt: now,
      completedAt:
        status === "completed" || status === "error" ? now : fact.completedAt,
      error: error,
      statuses: [...fact.statuses, newStatus],
    });
  },
});
