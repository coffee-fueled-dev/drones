import { v } from "convex/values";
import { internalMutation, mutation } from "../../customFunctions";
import { DocumentStatusSchema } from "../../entities/document.domain";
import { DocumentRepository } from "../../entities/documents.repository";

export const create = mutation({
  args: {
    document: v.object({
      name: v.string(),
      description: v.string(),
      storageId: v.id("_storage"),
    }),
  },
  handler: async (ctx, { document }) => {
    const now = Date.now();
    const createdDocument = await DocumentRepository.create(ctx, {
      ...document,
      createdAt: now,
      updatedAt: now,
      statuses: [
        {
          label: "pending",
          timestamp: now,
        },
      ],
    });

    if (!createdDocument) {
      throw new Error("Document not created");
    }

    return createdDocument._id;
  },
});

export const updateStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: DocumentStatusSchema,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, status, error }) => {
    console.log(`Updating document ${documentId} status to: ${status}`);

    const document = await ctx.db.get(documentId);
    if (!document) {
      console.error(`Document not found in updateStatus: ${documentId}`);
      throw new Error("Document not found");
    }

    const now = Date.now();
    const newStatus = {
      label: status,
      timestamp: now,
    };

    try {
      await ctx.db.patch(documentId, {
        updatedAt: now,
        completedAt:
          status === "completed" || status === "error"
            ? now
            : document.completedAt,
        error: error,
        statuses: [...document.statuses, newStatus],
      });
      console.log(`Successfully updated document status to: ${status}`);
    } catch (patchError) {
      console.error(`Error patching document:`, patchError);
      throw patchError;
    }
  },
});

export const createChunk = internalMutation({
  args: {
    documentId: v.id("documents"),
    position: v.number(),
    size: v.number(),
    content: v.string(),
  },
  handler: async (ctx, { documentId, position, size, content }) => {
    const now = Date.now();

    const chunkId = await ctx.db.insert("chunks", {
      createdAt: now,
      updatedAt: now,
      document: documentId,
      content: content,
      cursor: {
        position,
        size,
      },
      statuses: [
        {
          label: "pending",
          timestamp: now,
        },
      ],
    });

    return chunkId;
  },
});
