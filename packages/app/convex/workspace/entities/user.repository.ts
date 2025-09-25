import { createCoreRepositoryOperations } from "../../shared/repository";
import { IUserRepository } from "./user.domain";
import { UserTransaction } from "./user.transaction";

const baseRepository = createCoreRepositoryOperations("users");

export const UserRepository: IUserRepository = {
  ...baseRepository,

  startTransaction: async (ctx, id) => new UserTransaction(ctx).start(id),

  async find(ctx, { id, workosUserId }) {
    if (!id && !workosUserId) return null;

    if (id) {
      return await ctx.db.get(id);
    }

    if (workosUserId) {
      return await ctx.db
        .query("users")
        .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
        .first();
    }

    return null;
  },

  async upsert(ctx, userData) {
    const existingUser = await this.find(ctx, {
      workosUserId: userData.workosUserId,
    });

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
        updatedAt: Date.now(),
      });
      return newUser;
    }
  },
};
