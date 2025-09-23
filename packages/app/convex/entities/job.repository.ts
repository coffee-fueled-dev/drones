import { createCoreRepositoryOperations } from "../shared/repository";
import { JobRepository } from "./job.domain";

export const jobRepository: JobRepository =
  createCoreRepositoryOperations("jobs");
