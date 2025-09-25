import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { IRepository } from "../../shared/repository";
import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ITransaction } from "../../shared/transaction";

export const UserSchema = v.object({
  ...SystemFields("users"),
  name: v.optional(v.string()),
  email: v.string(),
  workosUserId: v.string(),
  threads: v.array(v.string()),
});

export type User = Infer<typeof UserSchema>;
export type NewUser = WithoutSystemFields<User>;

export interface IUserRepository extends IRepository<"users"> {
  find(
    ctx: QueryCtx,
    selector: {
      id?: Id<"users">;
      workosUserId?: string;
    }
  ): Promise<User | null>;

  upsert(ctx: MutationCtx, userData: NewUser): Promise<Id<"users">>;

  startTransaction(
    ctx: MutationCtx,
    id: Id<"users">
  ): Promise<IUserTransaction>;
}

export interface IUserTransaction extends ITransaction<"users"> {
  updateName(name: User["name"]): this;
  updateEmail(email: User["email"]): this;
  addThread(threadId: User["threads"][number]): this;
  removeThread(threadId: User["threads"][number]): this;
}
