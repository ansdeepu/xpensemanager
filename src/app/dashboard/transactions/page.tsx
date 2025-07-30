"use client";

import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { transactions } from "@/lib/data";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

export default function TransactionsPage() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <TransactionTable initialTransactions={transactions} accounts={[]} />
    </div>
  );
}
