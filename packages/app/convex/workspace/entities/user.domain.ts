import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { CoreRepositoryOperations } from "../../shared/repository";
import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

export const UserSchema = v.object({
  ...SystemFields("users"),
  name: v.optional(v.string()),
  email: v.string(),
  workosUserId: v.string(),
  threads: v.array(v.string()),
});

export type User = Infer<typeof UserSchema>;
export type NewUser = WithoutSystemFields<User>;

export interface IUserRepository extends CoreRepositoryOperations<"users"> {
  findByExternalId(ctx: QueryCtx, workosUserId: string): Promise<User | null>;
  upsert(ctx: MutationCtx, userData: NewUser): Promise<Id<"users">>;
}
