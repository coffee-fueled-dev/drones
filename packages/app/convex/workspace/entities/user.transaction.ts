import { ITransaction, Transaction } from "../../shared/transaction";
import { User } from "./user.domain";

export interface IUserTransaction extends ITransaction<"users"> {
  updateName(name: User["name"]): this;
  updateEmail(email: User["email"]): this;
  addThread(threadId: User["threads"][number]): this;
  removeThread(threadId: User["threads"][number]): this;
}

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
