import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { CoreRepositoryOperations } from "../../shared/repository";

export const FactSchema = v.object({
  ...SystemFields("facts"),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  externalId: v.optional(v.string()),
  chunk: v.id("chunks"),
  subject: v.string(),
  predicate: v.string(),
  object: v.string(),
  source: v.union(v.string(), v.null()),
  statuses: v.array(
    v.object({
      label: v.union(
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

export type Fact = Infer<typeof FactSchema>;
export type NewFact = WithoutSystemFields<Fact>;

export interface IFactRepository extends CoreRepositoryOperations<"facts"> {}
