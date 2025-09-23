import { defineTable } from "convex/server";
import { withoutSystemFields } from "convex-helpers";
import { ChunkSchema } from "./entities/chunk.domain";
import { FactSchema } from "./entities/fact.domain";
import { SourceSchema } from "./entities/source.domain";

export const knowledgeGraphTables = {
  sources: defineTable(withoutSystemFields(SourceSchema.fields)).index(
    "by_storageId",
    ["storageId"]
  ),

  chunks: defineTable(withoutSystemFields(ChunkSchema.fields)).index(
    "by_source",
    ["source"]
  ),

  facts: defineTable(withoutSystemFields(FactSchema.fields)).index("by_chunk", [
    "chunk",
  ]),
};
