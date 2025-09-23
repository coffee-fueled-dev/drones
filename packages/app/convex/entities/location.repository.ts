import { createCoreRepositoryOperations } from "../shared/repository";
import { LocationRepository } from "./location.domain";

export const locationRepository: LocationRepository =
  createCoreRepositoryOperations("locations");
