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
        },
      );
      promisedSteps.push(updateThreadStepPromise);
    }

    if (profile.type === "hardware-brand") {
      const addThreadToHardwareBrandProfileStepPromise = step.runMutation(
        internal.profiles.internal.mutations.addThreadToHardwareBrandProfile,
        {
          profileId: profile.id,
          threadId,
        },
      );
      promisedSteps.push(addThreadToHardwareBrandProfileStepPromise);
    }

    if (profile.type === "service-partner") {
      const addThreadToServicePartnerProfileStepPromise = step.runMutation(
        internal.profiles.internal.mutations.addThreadToServicePartnerProfile,
        {
          profileId: profile.id,
          threadId,
        },
      );
      promisedSteps.push(addThreadToServicePartnerProfileStepPromise);
    }

    await Promise.all(promisedSteps);

    return { threadId };
  },
});
