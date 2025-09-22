import { components } from "../../_generated/api";
import { paginationOptsValidator } from "convex/server";
import { query } from "../../customFunctions";
import { authorizeThreadAccess } from "../libs/authorizeThreadAccess";
import { getThreadMetadata, vStreamArgs } from "@convex-dev/agent";
import { Infer, v, Validator } from "convex/values";
import { UserRepository } from "../../id_auth/adapters/User.repository";
import { GenericAgent } from "../agents/GenericAgent/agent";
import { ProfileSelectorSchema } from "./mutations";
import { HardwareBrandProfileRepository } from "../../profiles/adapters/HardwareBrandProfile.repository";
import { ServicePartnerProfileRepository } from "../../profiles/adapters/ServicePartnerProfile.repository";

type Thread = Infer<typeof ThreadSchema>;
const ThreadSchema = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  status: v.union(v.literal("active"), v.literal("archived")),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  userId: v.optional(v.string()),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paginatedResponseSchema = <T>(itemSchema: Validator<T, any, any>) =>
  v.object({
    page: v.array(itemSchema),
    continueCursor: v.string(),
    isDone: v.boolean(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.literal("SplitNotSupported"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  });

export const listThreads = query({
  args: {
    workosUserId: v.string(),
    profile: ProfileSelectorSchema,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedResponseSchema(ThreadSchema),
  handler: async (ctx, args) => {
    const user = await UserRepository.findByExternalId(ctx, args.workosUserId);
    const userId = user?._id;
    if (!userId) throw new Error("Unauthorized: user is required");

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId, paginationOpts: args.paginationOpts }
    );
    return threads;
  },
});

export const getThreadDetails = query({
  args: { workosUserId: v.string(), threadId: v.string() },
  returns: v.object({
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
  }),
  handler: async (ctx, { workosUserId, threadId }) => {
    await authorizeThreadAccess(ctx, workosUserId, threadId);
    const { title, summary } = await getThreadMetadata(ctx, components.agent, {
      threadId,
    });
    return { title, summary };
  },
});

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { threadId, paginationOpts, streamArgs, workosUserId } = args;
    await authorizeThreadAccess(ctx, workosUserId, threadId);
    const streams = await GenericAgent.syncStreams(ctx, {
      threadId,
      streamArgs,
      includeStatuses: ["aborted", "streaming"],
    });
    const paginated = await GenericAgent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });

    // Filter out context messages that should not appear in the UI
    const filteredPage = paginated.page.filter((message) => {
      // Hide system role messages (these are context messages)
      return !(message.message && message.message.role === "system");
    });

    return {
      ...paginated,
      page: filteredPage,
      streams,
    };
  },
});

export const listThreadsByProfile = query({
  args: {
    profile: ProfileSelectorSchema,
    workosUserId: v.string(),
  },
  returns: v.array(ThreadSchema),
  handler: async (ctx, args) => {
    const { profile } = args;
    const user = await UserRepository.findByExternalId(ctx, args.workosUserId);
    const userId = user?._id;
    if (!userId) throw new Error("Unauthorized: user is required");

    let threadIds: string[] = [];

    if (profile.type === "hardware-brand") {
      const hbProfile = await HardwareBrandProfileRepository.get(
        ctx,
        profile.id
      );
      if (!hbProfile) {
        throw new Error("Hardware brand profile not found");
      }
      threadIds = hbProfile.threads ?? [];
    }
    if (profile.type === "service-partner") {
      const spProfile = await ServicePartnerProfileRepository.get(
        ctx,
        profile.id
      );
      if (!spProfile) {
        throw new Error("Service partner profile not found");
      }
      threadIds = spProfile.threads ?? [];
    }

    const threads = await Promise.all(
      threadIds.map((threadId) =>
        ctx.runQuery(components.agent.threads.getThread, { threadId })
      )
    );

    return threads.filter(
      (thread) => thread !== null && thread.userId === userId
    ) as Thread[];
  },
});
