import { defineSchema } from "convex/server";
import { knowledgeGraphTables } from "./knowledgeGraph/tables";
import { userManagementTables } from "./workspace/tables";

export default defineSchema({
  ...knowledgeGraphTables,
  ...userManagementTables,
});
