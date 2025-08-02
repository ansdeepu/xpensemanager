"use client"
import { AccountList } from "@/components/dashboard/bank-accounts/account-list";
import { accounts } from "@/lib/data";

export default function BankAccountsPage() {
  return (
    <div className="space-y-6">
      <AccountList initialAccounts={accounts} />
    </div>
  );
}
