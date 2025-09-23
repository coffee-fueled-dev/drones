import { QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { UserRepository } from "../entities/user.repository";

export async function authorizeThreadAccess(
  ctx: QueryCtx,
  workosUserId: string,
  threadId: string
): Promise<void> {
  // Find the user by their WorkOS ID
  const user = await UserRepository.findByExternalId(ctx, workosUserId);
  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  // Get the thread metadata to check ownership
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });

  if (!thread) {
    throw new Error("Thread not found");
  }

  // Check if the user owns this thread
  if (thread.userId !== user._id) {
    throw new Error("Unauthorized: Access denied to this thread");
  }
}
