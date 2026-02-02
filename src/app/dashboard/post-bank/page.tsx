"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Account, Category, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/hooks/use-auth-state";
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PostBankPage() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setDataLoading(true);

      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "income"));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setAllCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setDataLoading(false);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading]);

  const { postBankTransactions, postBankRelevantCategories, postBankAccountId } = useMemo(() => {
    // Find the Post Bank account
    const postBankAccount = accounts.find(acc => acc.name.toLowerCase().includes('post bank'));
    
    if (!postBankAccount) {
      return { postBankTransactions: [], postBankRelevantCategories: [], postBankAccountId: undefined };
    }

    // 1. Filter ALL transactions related to the Post Bank account
    const allPostBankTransactions = transactions.filter(t => 
        (t.accountId === postBankAccount.id) ||
        (t.fromAccountId === postBankAccount.id) ||
        (t.toAccountId === postBankAccount.id)
    );

    // 2. Find all income transactions related to the Post Bank to identify relevant categories
    const incomeTransactionsForPostBank = allPostBankTransactions.filter(t => 
        (t.type === 'income' && t.accountId === postBankAccount.id) ||
        (t.type === 'transfer' && t.toAccountId === postBankAccount.id)
    );
    
    const relevantCategoryIds = new Set(incomeTransactionsForPostBank.map(t => t.categoryId));

    // 3. Filter the income categories based on whether they have transactions in the Post Bank account
    const relevantCategories = allCategories.filter(cat => relevantCategoryIds.has(cat.id));

    return { 
        postBankTransactions: allPostBankTransactions, 
        postBankRelevantCategories: relevantCategories,
        postBankAccountId: postBankAccount.id
    };
  }, [accounts, transactions, allCategories]);


  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
        </Card>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!postBankAccountId) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Post Bank Account Not Found</CardTitle>
                <CardDescription>Please add an account with "Post Bank" in its name to use this page.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
       <PostCategoryAccordion
            categories={postBankRelevantCategories}
            transactions={postBankTransactions}
            postBankAccountId={postBankAccountId}
        />
    </div>
  );
}
