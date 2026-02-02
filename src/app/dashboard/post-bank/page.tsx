"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Account, Category, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/hooks/use-auth-state";
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// The list of categories the user wants to see.
const POST_BANK_CATEGORY_NAMES = [
  "Diesel Collection",
  "Staff Club Accounts",
  "Ente Keralam Accounts",
  "Seminar Accounts",
  "Jayaram Treatment",
  "SLR Retirement - Jan 2026",
  "Arun Babu - Loan",
  "Parameshwaran, Aivelil - Loan",
  "Harikrishnan, CML - Loan",
  "Leelamma - Loan",
  "Sooraj, BT, CML - Loan",
  "Arun Chettan - Loan",
  "Bank Charges",
  "Deepa Car Accounts",
];

export default function PostBankPage() {
  const [user, userLoading] = useAuthState();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
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
        setAllTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        setDataLoading(false);
      });
      
      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading]);

  const { postBankTransactionsWithBalance, virtualCategories, postBankAccountId } = useMemo(() => {
    const postBankAccount = accounts.find(acc => acc.name.toLowerCase().includes('post bank'));
    
    if (!postBankAccount) {
      return { postBankTransactionsWithBalance: [], virtualCategories: [], postBankAccountId: undefined };
    }

    // 1. Calculate final balance of Post Bank account
    let finalBalance = 0;
    const chronologicalTransactions = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chronologicalTransactions.forEach(t => {
      let effect = 0;
      
      if (t.type === 'income' && t.accountId === postBankAccount.id) {
          effect = t.amount;
      } else if (t.type === 'expense' && t.accountId === postBankAccount.id && t.paymentMethod === 'online') {
          effect = -t.amount;
      } else if (t.type === 'transfer') {
          if (t.fromAccountId === postBankAccount.id) effect = -t.amount;
          if (t.toAccountId === postBankAccount.id) effect = t.amount;
      }
      finalBalance += effect;
    });

    // 2. Filter for post bank transactions
    const postBankTransactions = allTransactions.filter(t => 
        (t.accountId === postBankAccount.id) ||
        (t.fromAccountId === postBankAccount.id) ||
        (t.toAccountId === postBankAccount.id)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first

    // 3. Calculate running balance for these transactions
    const correctBalances = new Map<string, number>();
    let correctRunningBalance = finalBalance;

    for (const t of postBankTransactions) {
      correctBalances.set(t.id, correctRunningBalance);
      
      let effect = 0;
      if (t.type === 'income' && t.accountId === postBankAccount.id) {
          effect = t.amount;
      } else if (t.type === 'expense' && t.accountId === postBankAccount.id && t.paymentMethod === 'online') {
          effect = -t.amount;
      } else if (t.type === 'transfer') {
          if (t.fromAccountId === postBankAccount.id) effect = -t.amount;
          if (t.toAccountId === postBankAccount.id) effect = t.amount;
      }
      correctRunningBalance -= effect; // Correct way to go backwards
    }

    const transactionsWithBalance = postBankTransactions.map(t => ({
        ...t,
        balance: correctBalances.get(t.id) ?? 0,
    }));
    
    const virtualCategories = POST_BANK_CATEGORY_NAMES.map(name => ({
        id: name,
        name: name,
        userId: user?.uid || '',
        icon: 'Tag',
        subcategories: [],
        order: 0,
        type: 'income' // Placeholder type
    } as Category));

    return { 
        postBankTransactionsWithBalance: transactionsWithBalance, 
        virtualCategories: virtualCategories,
        postBankAccountId: postBankAccount.id
    };
  }, [accounts, allTransactions, user]);


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
            categories={virtualCategories}
            transactions={postBankTransactionsWithBalance}
            postBankAccountId={postBankAccountId}
        />
    </div>
  );
}
