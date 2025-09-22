import { createCoreRepositoryOperations } from "../shared/repository";
import { PilotProfileRepository } from "./pilot.domain";

export const pilotProfileRepository: PilotProfileRepository =
  createCoreRepositoryOperations("pilotProfiles");
