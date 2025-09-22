import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { WithoutSystemFields } from "convex/server";
import { CoreRepositoryOperations } from "../shared/repository";

export const LocationSchema = v.object({
  ...SystemFields("locations"),
  address: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  country: v.string(),
  mapboxPlaceId: v.optional(v.string()),
});

export type Location = Infer<typeof LocationSchema>;
export type NewLocation = WithoutSystemFields<Location>;

export interface LocationRepository
  extends CoreRepositoryOperations<"locations"> {}
