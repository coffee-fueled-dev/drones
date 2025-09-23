import { v } from "convex/values";
import { components, internal } from "../../../_generated/api";
import { abortStream, createThread, listStreams } from "@convex-dev/agent";
import { mutation } from "../../../_generated/server";
import { authorizeThreadAccess } from "../../libs";
import { UserRepository } from "../../../entities/user.repository";
import { OperatorAgent } from "../../operator";
import { workflow } from "../../../workflow";
import { Message } from "@convex-dev/agent/validators";
import { internalMutation } from "../../../customFunctions";

export const createNewThread = mutation({
  args: {
    workosUserId: v.string(),
    initialMessage: v.optional(
      v.object({
        prompt: v.string(),
        context: v.optional(v.string()),
      })
    ),
  },
  returns: v.object({
    threadId: v.string(),
  }),
  handler: async (ctx, { workosUserId, initialMessage }) => {
    // User should already exist from OAuth callback
    const user = await UserRepository.findByExternalId(ctx, workosUserId);
    if (!user) {
      throw new Error("User not found. Please sign in again.");
    }

    const userId = user._id;
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
        internal.agent.operations.actions.thread.streamAsync,
        {
          threadId,
          promptMessageId:
            scheduledMessages[scheduledMessages.length - 1].messageId,
        }
      );
    }

    await workflow.start(
      ctx,
      internal.agent.operations.workflows.thread.setupNewThread,
      {
        threadId,
        userId,
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
      internal.agent.operations.actions.thread.streamAsync,
      {
        threadId,
        promptMessageId:
          scheduledMessages[scheduledMessages.length - 1].messageId,
      }
    );

    return { threadId };
  },
});

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

export const addThreadToUser = internalMutation({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
  },
  handler: async (ctx, { userId, threadId }) => {
    const user = await UserRepository.get(ctx, userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existingThreads = user.threads ?? [];
    if (!existingThreads.includes(threadId)) {
      await ctx.db.patch(userId, {
        threads: [...existingThreads, threadId],
      });
    }
  },
});

export const createOrUpdateUser = mutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { workosUserId, email, name }) => {
    await UserRepository.upsert(ctx, {
      workosUserId,
      email,
      name,
      documents: [],
      threads: [],
    });
  },
});
