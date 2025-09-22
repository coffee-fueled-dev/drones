import { createCoreRepositoryOperations } from "../shared/repository";
import { OperatorProfileRepository } from "./operator.domain";

export const operatorProfileRepository: OperatorProfileRepository =
  createCoreRepositoryOperations("operatorProfiles");
