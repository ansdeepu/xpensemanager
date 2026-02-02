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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
        setDataLoading(false); // Set loading to false after transactions are fetched
      });
      
      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading]);

  const { postBankTransactions, virtualCategories, postBankAccountId } = useMemo(() => {
    const postBankAccount = accounts.find(acc => acc.name.toLowerCase().includes('post bank'));
    
    if (!postBankAccount) {
      return { postBankTransactions: [], virtualCategories: [], postBankAccountId: undefined };
    }

    const allPostBankTransactions = transactions.filter(t => 
        (t.accountId === postBankAccount.id) ||
        (t.fromAccountId === postBankAccount.id) ||
        (t.toAccountId === postBankAccount.id)
    );

    // Create "virtual" category objects from the user's list.
    const virtualCategories = POST_BANK_CATEGORY_NAMES.map(name => ({
        id: name, // Use name as ID for simplicity
        name: name,
        userId: user?.uid || '',
        icon: 'Tag', // Default icon
        subcategories: [],
        order: 0,
        type: 'income' // Type isn't strictly used in this component, but set for consistency
    } as Category));

    return { 
        postBankTransactions: allPostBankTransactions, 
        virtualCategories: virtualCategories,
        postBankAccountId: postBankAccount.id
    };
  }, [accounts, transactions, user]);


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
            transactions={postBankTransactions}
            postBankAccountId={postBankAccountId}
        />
    </div>
  );
}
