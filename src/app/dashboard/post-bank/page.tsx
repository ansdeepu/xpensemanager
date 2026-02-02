
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Account, Category, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";
import { Card, CardContent } from "@/components/ui/card";

export default function PostBankPage() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [postBankAccount, setPostBankAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const unsubscribes: (()=>void)[] = [];
      unsubscribes.push(onSnapshot(query(collection(db, "accounts"), where("userId", "==", user.uid)), (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        const postAccount = userAccounts.find(acc => acc.name.toLowerCase().includes("post bank"));
        setPostBankAccount(postAccount || null);
      }));

      unsubscribes.push(onSnapshot(query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "income")), (snapshot) => {
        setIncomeCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      }));
      
      unsubscribes.push(onSnapshot(query(collection(db, "transactions"), where("userId", "==", user.uid)), (snapshot) => {
          setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
          setLoading(false);
      }));

      return () => unsubscribes.forEach(unsub => unsub());
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const postBankTransactions = useMemo(() => {
      if (!postBankAccount) return [];
      return transactions.filter(t => t.accountId === postBankAccount.id);
  }, [transactions, postBankAccount]);

  if (loading || userLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!postBankAccount) {
      return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <p>"Post Bank" account not found. Please create an account with "Post Bank" in its name.</p>
                </div>
            </CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
      <PostCategoryAccordion categories={incomeCategories} transactions={postBankTransactions} isEditable={false} />
    </div>
  );
}
