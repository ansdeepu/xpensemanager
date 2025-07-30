"use client"
import { AccountList } from "@/components/dashboard/bank-accounts/account-list";
import { accounts } from "@/lib/data";

export default function BankAccountsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bank Accounts</h1>
      <AccountList initialAccounts={accounts} />
    </div>
  );
}
