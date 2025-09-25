import { v } from "convex/values";
import { internalMutation } from "../../../../../customFunctions";
import { FactRepository } from "../../../../entities/fact.repository";

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
    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    const updatedFact = await FactRepository.startTransaction(ctx, factId).then(
      (tx) => {
        tx.addStatus(newStatus);
        if (status === "completed" || status === "error") tx.setCompleted(now);
        if (error) tx.setError(error, now);
        return tx.commit();
      }
    );

    return updatedFact;
  },
});
