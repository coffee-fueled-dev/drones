import { Transaction } from "../../shared/transaction";
import { IUserTransaction, User } from "./user.domain";

export class UserTransaction
  extends Transaction<"users">
  implements IUserTransaction
{
  updateName = (name: User["name"]): this =>
    this._update((user) => ({ ...user, name }));

  updateEmail = (email: User["email"]): this =>
    this._update((user) => ({ ...user, email }));

  addThread = (threadId: User["threads"][number]): this =>
    this._update((user) => ({ ...user, threads: [...user.threads, threadId] }));

  removeThread = (threadId: User["threads"][number]): this =>
    this._update((user) => ({
      ...user,
      threads: user.threads.filter((id) => id !== threadId),
    }));
}
