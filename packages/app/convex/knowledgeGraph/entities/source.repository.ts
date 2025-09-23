import { createCoreRepositoryOperations } from "../../shared/repository";
import { ISourceRepository } from "./source.domain";

export const SourceRepository: ISourceRepository =
  createCoreRepositoryOperations("sources");
