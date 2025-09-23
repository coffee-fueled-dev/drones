import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { CoreRepositoryOperations } from "../shared/repository";

export type DocumentStatus = Infer<typeof DocumentStatusSchema>;
export const DocumentStatusSchema = v.union(
  v.literal("pending"),
  v.literal("chunking"),
  v.literal("chunked"),
  v.literal("extracting"),
  v.literal("extracted"),
  v.literal("syncing"),
  v.literal("synced"),
  v.literal("completed"),
  v.literal("error")
);

export const DocumentSchema = v.object({
  ...SystemFields("documents"),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  storageId: v.id("_storage"),
  statuses: v.array(
    v.object({
      label: DocumentStatusSchema,
      timestamp: v.number(),
    })
  ),
});

export type Document = Infer<typeof DocumentSchema>;
export type NewDocument = WithoutSystemFields<Document>;

export interface IDocumentRepository
  extends CoreRepositoryOperations<"documents"> {}
