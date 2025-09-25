import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { IRepository } from "../../shared/repository";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ITransaction } from "../../shared/transaction";

export type SourceStatus = Infer<typeof SourceStatusSchema>;
export const SourceStatusSchema = v.union(
  v.literal("pending"),
  v.literal("chunking"),
  v.literal("chunked"),
  v.literal("extracting"),
  v.literal("extracted"),
  v.literal("syncing"),
  v.literal("synced"),
  v.literal("completed"),
  v.literal("error")
);

export const SourceSchema = v.object({
  ...SystemFields("sources"),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  storageId: v.id("_storage"),
  statuses: v.array(
    v.object({
      label: SourceStatusSchema,
      timestamp: v.number(),
    })
  ),
});

export type Source = Infer<typeof SourceSchema>;
export type NewSource = WithoutSystemFields<Source>;

export interface ISourceRepository extends IRepository<"sources"> {
  startTransaction(
    ctx: MutationCtx,
    id: Id<"sources">
  ): Promise<ISourceTransaction>;
}

export interface ISourceTransaction extends ITransaction<"sources"> {
  addStatus(status: Source["statuses"][number]): this;
  setCompleted(timestamp?: number): this;
  setError(error: string, timestamp?: number): this;
  updateName(name: string): this;
  updateDescription(description: string): this;
}
