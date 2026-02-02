"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Account, Category, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/hooks/use-auth-state";
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PostBankPage() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
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

  const { postBankTransactions, incomeCategories, postBankAccountId } = useMemo(() => {
    const postBankAccount = accounts.find(acc => acc.name.toLowerCase().includes('post bank'));
    
    if (!postBankAccount) {
      return { postBankTransactions: [], incomeCategories: [], postBankAccountId: undefined };
    }

    const filteredTransactions = transactions.filter(t => 
        (t.accountId === postBankAccount.id) ||
        (t.fromAccountId === postBankAccount.id) ||
        (t.toAccountId === postBankAccount.id)
    );
    
    const transactionCategoryIds = new Set(filteredTransactions.map(t => t.categoryId));

    const filteredIncomeCategories = categories.filter(cat => 
      cat.type === 'income' && transactionCategoryIds.has(cat.id)
    );

    return { 
        postBankTransactions: filteredTransactions, 
        incomeCategories: filteredIncomeCategories,
        postBankAccountId: postBankAccount.id
    };
  }, [accounts, transactions, categories]);


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

  return (
    <div className="space-y-6">
       <PostCategoryAccordion
            categories={incomeCategories}
            transactions={postBankTransactions}
            isEditable={false}
            postBankAccountId={postBankAccountId}
        />
    </div>
  );
}
