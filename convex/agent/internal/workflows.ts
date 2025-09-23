import { workflow } from "../../workflow";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { ProfileSelectorSchema } from "../public/mutations";

export const setupNewThread = workflow.define({
  args: {
    setTitle: v.boolean(),
    threadId: v.string(),
    profile: ProfileSelectorSchema,
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (step, args) => {
    const { threadId, profile, setTitle } = args;

    const promisedSteps: Promise<null>[] = [];

    if (setTitle) {
      const updateThreadStepPromise = step.runAction(
        internal.agent.internal.actions.updateThreadTitle,
        {
          threadId,
        }
      );
      promisedSteps.push(updateThreadStepPromise);
    }

    if (profile.type === "operator") {
      const addThreadToOperatorProfileStepPromise = step.runMutation(
        internal.agent.internal.mutations.addThreadToOperatorProfile,
        {
          profileId: profile.id,
          threadId,
        }
      );
      promisedSteps.push(addThreadToOperatorProfileStepPromise);
    }

    await Promise.all(promisedSteps);

    return { threadId };
  },
});
