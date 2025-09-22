import { defineSchema } from "convex/server";
import { sharedTables } from "./entities/tables";

export default defineSchema(sharedTables);
