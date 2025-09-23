import { createCoreRepositoryOperations } from "../shared/repository";
import { UserRepository } from "./user.domain";

export const userRepository: UserRepository =
  createCoreRepositoryOperations("users");
