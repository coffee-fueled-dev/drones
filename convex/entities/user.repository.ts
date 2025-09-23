import { MutationCtx, QueryCtx } from "../_generated/server";
import { createCoreRepositoryOperations } from "../shared/repository";
import {
  UserRepository as IUserRepository,
  NewUserSchema,
  User,
} from "./user.domain";
import { Infer } from "convex/values";

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

  async upsert(
    ctx: MutationCtx,
    userData: Infer<typeof NewUserSchema>
  ): Promise<string> {
    const existingUser = await this.findByExternalId(
      ctx,
      userData.workosUserId
    );

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        ...userData,
        _updatedAt: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user
      const newUser = await ctx.db.insert("users", {
        ...userData,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });
      return newUser;
    }
  },
};
