import { v } from "convex/values";
import { components } from "../../_generated/api";
import { listStreams, abortStream } from "@convex-dev/agent";
import { internalMutation } from "../../_generated/server";
import { operatorProfileRepository } from "../../entities/operator.repository";

export const abortStreamByStreamId = internalMutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const streams = await listStreams(ctx, components.agent, { threadId });
    for (const stream of streams) {
      console.log("Aborting stream", stream);
      await abortStream(ctx, components.agent, {
        reason: "Aborting via async call",
        streamId: stream.streamId,
      });
    }
    if (!streams.length) {
      console.log("No streams found");
    }
  },
});

export const addThreadToOperatorProfile = internalMutation({
  args: {
    profileId: v.id("operatorProfiles"),
    threadId: v.string(),
  },
  handler: async (ctx, { profileId, threadId }) => {
    const profile = await operatorProfileRepository.get(ctx, profileId);
    if (!profile) {
      throw new Error("Operator profile not found");
    }

    const existingThreads = profile.threads ?? [];
    if (!existingThreads.includes(threadId)) {
      await ctx.db.patch(profileId, {
        threads: [...existingThreads, threadId],
      });
    }
  },
});
