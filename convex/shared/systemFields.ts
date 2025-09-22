import { v } from "convex/values";

export const SystemFields = <T extends string>(table: T) => ({
  _id: v.id(table),
  _createdAt: v.number(),
  _updatedAt: v.number(),
  name: v.string(),
  description: v.string(),
});
