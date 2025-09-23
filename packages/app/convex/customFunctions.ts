/* eslint-disable no-restricted-imports */
// This file needs to import from _generated/server to create custom functions with middleware
import { Triggers } from "convex-helpers/server/triggers";
import { DataModel } from "./_generated/dataModel";
import {
  mutation as rawMutation,
  internalMutation as rawInternalMutation,
  query as rawQuery,
  internalQuery as rawInternalQuery,
  action as rawAction,
  internalAction as rawInternalAction,
} from "./_generated/server";
/* eslint-enable no-restricted-imports */
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";

// Register Triggers.
const triggers = new Triggers<DataModel>();
// enable children files to register triggers receiving the triggers instance
import { registerTriggers } from "./knowledgeGraph/triggers";
registerTriggers(triggers);

// Create custom functions that include triggers and other middleware
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// For queries and actions, we use the raw functions directly since they don't need triggers
export const query = rawQuery;
export const internalQuery = rawInternalQuery;
export const action = rawAction;
export const internalAction = rawInternalAction;
