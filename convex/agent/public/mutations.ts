import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import { abortStream, createThread } from "@convex-dev/agent";
import { mutation } from "../../customFunctions";
import { authorizeThreadAccess } from "../libs/authorizeThreadAccess";
import { UserRepository } from "../../id_auth/adapters/User.repository";
import { NewUserSchema } from "../../id_auth/domain/User.entity";
import { ToolConfigSchema, Agents } from "../agents";
import { workflow } from "../../workflow";
import { Message } from "@convex-dev/agent/validators";

export const ProfileSelectorSchema = v.union(
  v.object({
    type: v.literal("hardware-brand"),
    id: v.id("hardwareBrandProfiles"),
  }),
  v.object({
    type: v.literal("service-partner"),
    id: v.id("servicePartnerProfiles"),
  }),
);

export const createNewThread = mutation({
  args: {
    user: NewUserSchema,
    toolConfig: v.optional(ToolConfigSchema),
    initialMessage: v.optional(
      v.object({
        prompt: v.string(),
        context: v.optional(v.string()),
      }),
    ),
    profile: ProfileSelectorSchema,
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (ctx, { user, toolConfig, initialMessage, profile }) => {
    const userId = await UserRepository.upsert(ctx, user);
    const agent = Agents[toolConfig?.agentName ?? "generic-agent"];

    const threadId = await createThread(ctx, components.agent, {
      userId,
    });

    if (initialMessage) {
      const { prompt, context } = initialMessage;
      const messages: { message: Message; skipEmbeddings: boolean }[] = [];

      if (context) {
        messages.push({
          message: { role: "system", content: context },
          skipEmbeddings: true,
        });
      }

      messages.push({
        message: { role: "user", content: prompt },
        skipEmbeddings: true,
      });

      const scheduledMessages = await Promise.all(
        messages.map(({ message, skipEmbeddings }) =>
          agent.saveMessage(ctx, {
            threadId,
            message,
            skipEmbeddings,
          }),
        ),
      );

      await ctx.scheduler.runAfter(
        0,
        internal.agent.internal.actions.streamAsync,
        {
          threadId,
          promptMessageId:
            scheduledMessages[scheduledMessages.length - 1].messageId,
          toolConfig,
        },
      );
    }

    await workflow.start(
      ctx,
      internal.agent.internal.workflows.setupNewThread,
      {
        threadId,
        profile,
        setTitle: initialMessage !== undefined,
      },
    );

    return { threadId };
  },
});

/**
 * Abort a stream by its order
 */
export const abortStreamByOrder = mutation({
  args: { workosUserId: v.string(), threadId: v.string(), order: v.number() },
  handler: async (ctx, { workosUserId, threadId, order }) => {
    await authorizeThreadAccess(ctx, workosUserId, threadId);
    if (
      await abortStream(ctx, components.agent, {
        threadId,
        order,
        reason: "Aborting explicitly",
      })
    ) {
      console.log("Aborted stream", threadId, order);
    } else {
      console.log("No stream found", threadId, order);
    }
  },
});

export const scheduleMessage = mutation({
  args: {
    threadId: v.string(),
    workosUserId: v.string(),
    toolConfig: v.optional(ToolConfigSchema),
    prompt: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (
    ctx,
    { threadId, workosUserId, toolConfig, prompt, context },
  ) => {
    await authorizeThreadAccess(ctx, workosUserId, threadId);
    const agent = Agents[toolConfig?.agentName ?? "generic-agent"];

    const messages: { message: Message; skipEmbeddings: boolean }[] = [];

    if (context) {
      messages.push({
        message: { role: "system", content: context },
        skipEmbeddings: true,
      });
    }

    messages.push({
      message: { role: "user", content: prompt },
      skipEmbeddings: true,
    });

    const scheduledMessages = await Promise.all(
      messages.map(({ message }) =>
        agent.saveMessage(ctx, {
          threadId,
          message,
          skipEmbeddings: true,
        }),
      ),
    );

    await ctx.scheduler.runAfter(
      0,
      internal.agent.internal.actions.streamAsync,
      {
        threadId,
        promptMessageId:
          scheduledMessages[scheduledMessages.length - 1].messageId,
        toolConfig,
      },
    );

    return { threadId };
  },
});
