import { ITransaction, Transaction } from "../../shared/transaction";
import { Company } from "./company.domain";

export interface ICompanyTransaction extends ITransaction<"companies"> {
  updateEmail(email: Company["email"]): this;
  updateName(name: Company["name"]): this;
  addThread(threadId: Company["threads"][number]): this;
  removeThread(threadId: Company["threads"][number]): this;
}

export class CompanyTransaction
  extends Transaction<"companies">
  implements ICompanyTransaction
{
  addThread = (threadId: Company["threads"][number]): this =>
    this._update((company) => ({
      ...company,
      threads: [...company.threads, threadId],
    }));

  removeThread = (threadId: Company["threads"][number]): this =>
    this._update((company) => ({
      ...company,
      threads: company.threads.filter((id) => id !== threadId),
    }));

  updateEmail = (email: Company["email"]): this =>
    this._update((company) => ({ ...company, email }));

  updateName = (name: Company["name"]): this =>
    this._update((company) => ({ ...company, name }));
}
