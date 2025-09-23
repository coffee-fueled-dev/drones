import { createCoreRepositoryOperations } from "../../shared/repository";
import { IFactRepository } from "./fact.domain";

export const FactRepository: IFactRepository =
  createCoreRepositoryOperations("facts");
