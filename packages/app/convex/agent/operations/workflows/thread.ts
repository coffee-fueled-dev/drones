import { workflow } from "../../../workflow";
import { v } from "convex/values";
import { internal } from "../../../_generated/api";

export const setupNewThread = workflow.define({
  args: {
    setTitle: v.boolean(),
    threadId: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (step, args) => {
    const { threadId, userId, setTitle } = args;

    const promisedSteps: Promise<null>[] = [];

    if (setTitle) {
      const updateThreadStepPromise = step.runAction(
        internal.agent.operations.actions.thread.updateThreadTitle,
        {
          threadId,
        }
      );
      promisedSteps.push(updateThreadStepPromise);
    }

    // Add the thread to the user's thread list
    const addThreadToUserStepPromise = step.runMutation(
      internal.agent.operations.mutations.thread.addThreadToUser,
      {
        userId,
        threadId,
      }
    );
    promisedSteps.push(addThreadToUserStepPromise);

    await Promise.all(promisedSteps);

    return { threadId };
  },
});
