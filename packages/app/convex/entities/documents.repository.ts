import { createCoreRepositoryOperations } from "../shared/repository";
import { IDocumentRepository } from "./document.domain";

export const DocumentRepository: IDocumentRepository =
  createCoreRepositoryOperations("documents");
