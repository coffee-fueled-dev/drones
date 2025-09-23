import { v } from "convex/values";
import { OperatorAgent } from "./operator";

export const ToolConfigSchema = v.object({
  agentName: v.optional(v.string()),
});

export { OperatorAgent };
