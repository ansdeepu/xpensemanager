
"use client";

import { useState, useEffect } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TransactionsPage() {
  const [user, loading] = useAuthState(auth);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(userAccounts);
        setAccountsLoading(false);
      });
      return () => unsubscribe();
    } else if (!loading) {
        setAccountsLoading(false);
    }
  }, [user, loading]);

  const primaryAccount = accounts.find(a => a.isPrimary);

  if (loading || accountsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={primaryAccount?.id || "all"} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
          {primaryAccount && (
            <TabsTrigger value={primaryAccount.id}>Primary Account ({primaryAccount.name})</TabsTrigger>
          )}
          {accounts.map(account => (
            !account.isPrimary && <TabsTrigger key={account.id} value={account.id}>{account.name}</TabsTrigger>
          ))}
        </TabsList>
        {primaryAccount && (
            <TabsContent value={primaryAccount.id} className="mt-6">
                <TransactionTable accountId={primaryAccount.id} isPrimaryView={true} />
            </TabsContent>
        )}
         {accounts.map(account => (
            !account.isPrimary && (
                <TabsContent key={account.id} value={account.id} className="mt-6">
                    <TransactionTable accountId={account.id} isPrimaryView={false} />
                </TabsContent>
            )
        ))}
      </Tabs>
    </div>
  );
}
