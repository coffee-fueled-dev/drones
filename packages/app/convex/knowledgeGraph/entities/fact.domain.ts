import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { IRepository } from "../../shared/repository";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ITransaction } from "../../shared/transaction";

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

export interface IFactRepository extends IRepository<"facts"> {
  startTransaction(
    ctx: MutationCtx,
    id: Id<"facts">
  ): Promise<IFactTransaction>;
}

export interface IFactTransaction extends ITransaction<"facts"> {
  addStatus(status: Fact["statuses"][number]): this;
  setCompleted(timestamp?: number): this;
  setError(error: string, timestamp?: number): this;
  updateSubject(subject: string): this;
  updatePredicate(predicate: string): this;
  updateObject(object: string): this;
  updateSource(source: string | null): this;
}
