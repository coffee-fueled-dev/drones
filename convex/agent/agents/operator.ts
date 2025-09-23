import { Agent } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { defaultConfig } from "./config";
import { chat } from "./models";

export const OperatorAgent = new Agent(components.agent, {
  ...defaultConfig,
  name: "Operator Agent",
  languageModel: chat,
});
