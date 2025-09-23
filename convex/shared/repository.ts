import { MutationCtx, QueryCtx } from "../_generated/server";
import { DocumentByName, WithoutSystemFields } from "convex/server";
import { DataModel } from "../_generated/dataModel";

export const createCoreRepositoryOperations = <
  TTableName extends keyof DataModel,
>(
  tableName: TTableName,
): CoreRepositoryOperations<TTableName> => ({
  create: async (ctx, profile) =>
    ctx.db.get(await ctx.db.insert(tableName, profile)),

  delete: async (ctx, id) => ctx.db.delete(id),

  list: async (ctx) => ctx.db.query(tableName).collect(),

  save: async (ctx, profile) =>
    ctx.db.patch(profile._id, {
      ...profile,
      updatedAt: Date.now(),
    }),

  get: async (ctx, id) => ctx.db.get(id),
});

export interface CoreRepositoryOperations<TTableName extends keyof DataModel> {
  create(
    ctx: MutationCtx,
    profile: WithoutSystemFields<DocumentByName<DataModel, TTableName>>,
  ): Promise<DocumentByName<DataModel, TTableName> | null>;
  save(
    ctx: MutationCtx,
    profile: DocumentByName<DataModel, TTableName>,
  ): Promise<void>;
  get(
    ctx: QueryCtx,
    id: DocumentByName<DataModel, TTableName>["_id"],
  ): Promise<DocumentByName<DataModel, TTableName> | null>;
  delete(
    ctx: MutationCtx,
    id: DocumentByName<DataModel, TTableName>["_id"],
  ): Promise<void>;
  list(ctx: QueryCtx): Promise<DocumentByName<DataModel, TTableName>[]>;
}
