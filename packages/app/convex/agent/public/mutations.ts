import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import { abortStream, createThread } from "@convex-dev/agent";
import { mutation } from "../../_generated/server";
import { authorizeThreadAccess } from "../libs/authorizeThreadAccess";
import { UserRepository } from "../../entities/user.repository";
import { NewUserSchema } from "../../entities/user.domain";
import { ToolConfigSchema, OperatorAgent } from "../agents";
import { workflow } from "../../workflow";
import { Message } from "@convex-dev/agent/validators";

export const ProfileSelectorSchema = v.object({
  type: v.literal("operator"),
  id: v.id("operatorProfiles"),
});

export const createNewThread = mutation({
  args: {
    user: NewUserSchema,
    toolConfig: v.optional(ToolConfigSchema),
    initialMessage: v.optional(
      v.object({
        prompt: v.string(),
        context: v.optional(v.string()),
      })
    ),
    profile: ProfileSelectorSchema,
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (ctx, { user, toolConfig, initialMessage, profile }) => {
    const userId = await UserRepository.upsert(ctx, user);
    const agent = OperatorAgent;

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
          })
        )
      );

      await ctx.scheduler.runAfter(
        0,
        internal.agent.internal.actions.streamAsync,
        {
          threadId,
          promptMessageId:
            scheduledMessages[scheduledMessages.length - 1].messageId,
        }
      );
    }

    await workflow.start(
      ctx,
      internal.agent.internal.workflows.setupNewThread,
      {
        threadId,
        profile,
        setTitle: initialMessage !== undefined,
      }
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
    prompt: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (ctx, { threadId, workosUserId, prompt, context }) => {
    await authorizeThreadAccess(ctx, workosUserId, threadId);
    const agent = OperatorAgent;

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
        })
      )
    );

    await ctx.scheduler.runAfter(
      0,
      internal.agent.internal.actions.streamAsync,
      {
        threadId,
        promptMessageId:
          scheduledMessages[scheduledMessages.length - 1].messageId,
      }
    );

    return { threadId };
  },
});
