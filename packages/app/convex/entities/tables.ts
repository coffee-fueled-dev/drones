import { defineTable } from "convex/server";
import { withoutSystemFields } from "convex-helpers";
import { UserSchema } from "./user.domain";
import { ChunkSchema } from "./chunk.domain";
import { FactSchema } from "./fact.domain";
import { DocumentSchema } from "./document.domain";

export const sharedTables = {
  documents: defineTable(withoutSystemFields(DocumentSchema.fields)).index(
    "by_storageId",
    ["storageId"]
  ),

  chunks: defineTable(withoutSystemFields(ChunkSchema.fields)).index(
    "by_document",
    ["document"]
  ),

  facts: defineTable(withoutSystemFields(FactSchema.fields)).index("by_chunk", [
    "chunk",
  ]),

  users: defineTable(withoutSystemFields(UserSchema.fields))
    .index("by_name", ["name"])
    .index("by_email", ["email"])
    .index("by_workosUserId", ["workosUserId"]),
};
