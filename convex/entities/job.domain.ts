import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { CoreRepositoryOperations } from "../shared/repository";

export const JobSchema = v.object({
  ...SystemFields("jobs"),
  operator: v.id("operators"),
  location: v.id("locations"),
});

export type Job = Infer<typeof JobSchema>;
export type NewJob = WithoutSystemFields<Job>;

export interface JobRepository extends CoreRepositoryOperations<"jobs"> {}
