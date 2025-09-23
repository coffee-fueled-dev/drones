import { defineSchema } from "convex/server";
import { knowledgeGraphTables } from "./knowledgeGraph/tables";
import { workspaceTables } from "./workspace/tables";

export default defineSchema({
  ...knowledgeGraphTables,
  ...workspaceTables,
});
