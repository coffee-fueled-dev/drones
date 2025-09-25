import { Transaction } from "../../shared/transaction";
import { Company, ICompanyTransaction } from "./company.domain";

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
