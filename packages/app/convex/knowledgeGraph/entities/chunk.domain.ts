import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";

export const ChunkSchema = v.object({
  ...SystemFields("chunks"),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  externalId: v.optional(v.string()),
  source: v.id("sources"),
  facts: v.optional(v.array(v.id("facts"))),
  content: v.string(),
  context: v.optional(
    v.object({
      local: v.array(v.string()),
      recentGlobal: v.array(v.string()),
    })
  ),
  cursor: v.object({
    position: v.number(),
    size: v.number(),
  }),
  statuses: v.array(
    v.object({
      label: v.union(
        v.literal("pending"),
        v.literal("extracting"),
        v.literal("extracted"),
        v.literal("syncing"),
        v.literal("synced"),
        v.literal("completed"),
        v.literal("error")
      ),
      timestamp: v.number(),
    })
  ),
});

export type Chunk = Infer<typeof ChunkSchema>;
export type NewChunk = WithoutSystemFields<Chunk>;
