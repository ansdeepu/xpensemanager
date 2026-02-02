"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Account, Category, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";
import { Card, CardContent } from "@/components/ui/card";

export default function PostBankPage() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [bankExpenseCategories, setBankExpenseCategories] = useState<Category[]>([]);
  const [postBankAccount, setPostBankAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Fetch accounts to find 'post bank'
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        const postAccount = userAccounts.find(acc => acc.name.toLowerCase().includes("post bank"));
        setPostBankAccount(postAccount || null);
      });

      // Fetch categories
      const incomeCatQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "income"));
      const unsubscribeIncomeCats = onSnapshot(incomeCatQuery, (snapshot) => {
        setIncomeCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      });

      const bankExpenseCatQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "bank-expense"));
      const unsubscribeBankExpenseCats = onSnapshot(bankExpenseCatQuery, (snapshot) => {
        const combinedCategories = [...incomeCategories, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category))];
        const uniqueCategories = Array.from(new Map(combinedCategories.map(item => [item['name'], item])).values());
        setBankExpenseCategories(uniqueCategories);
      });
      

      // Fetch all transactions
      const transQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transQuery, (snapshot) => {
          setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
          setLoading(false);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeIncomeCats();
        unsubscribeBankExpenseCats();
        unsubscribeTransactions();
      };
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading, incomeCategories]);

  const postBankTransactions = transactions.filter(t => t.accountId === postBankAccount?.id);

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
      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="income">Income Categories</TabsTrigger>
          <TabsTrigger value="bank_expense">Bank Expense Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-6">
          <PostCategoryAccordion
            categories={incomeCategories}
            transactions={postBankTransactions}
            isEditable={true}
          />
        </TabsContent>
        <TabsContent value="bank_expense" className="mt-6">
          <PostCategoryAccordion
            categories={bankExpenseCategories}
            transactions={postBankTransactions}
            isEditable={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
