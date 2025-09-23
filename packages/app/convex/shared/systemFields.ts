import { v } from "convex/values";

export const SystemFields = <T extends string>(table: T) => ({
  _id: v.id(table),
  createdAt: v.number(),
  updatedAt: v.number(),
});
