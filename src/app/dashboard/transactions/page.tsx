"use client";

import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { transactions } from "@/lib/data";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-[600px] w-full" />
        </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <TransactionTable initialTransactions={transactions} />
    </div>
  );
}
