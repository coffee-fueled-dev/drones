import { MutationCtx, QueryCtx } from "../_generated/server";
import { createCoreRepositoryOperations } from "../shared/repository";
import { IUserRepository, NewUser, User } from "./user.domain";
import { Id } from "../_generated/dataModel";

const baseRepository = createCoreRepositoryOperations("users");

export const UserRepository: IUserRepository = {
  ...baseRepository,

  async findByExternalId(
    ctx: QueryCtx,
    workosUserId: string
  ): Promise<User | null> {
    return await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
  },

  async upsert(ctx: MutationCtx, userData: NewUser): Promise<Id<"users">> {
    const existingUser = await this.findByExternalId(
      ctx,
      userData.workosUserId
    );

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        ...userData,
        updatedAt: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user
      const newUser = await ctx.db.insert("users", {
        ...userData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return newUser;
    }
  },
};
