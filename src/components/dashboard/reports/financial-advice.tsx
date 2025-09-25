
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lightbulb, TrendingDown, Target, Wallet } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type AdviceProps = {
  totalIncome: number;
  totalExpense: number;
  expenseByCategory: { [key: string]: number };
};

export function FinancialAdvice({ totalIncome, totalExpense, expenseByCategory }: AdviceProps) {
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  const topCategories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const getSavingsAdvice = () => {
    if (savingsRate > 20) {
      return {
        title: "Excellent Savings!",
        message: `You're saving ${savingsRate.toFixed(0)}% of your income. Keep up the great work! Consider investing these savings to grow your wealth.`,
      };
    }
    if (savingsRate > 0) {
      return {
        title: "Good Progress!",
        message: `You're saving ${savingsRate.toFixed(0)}% of your income. To save more, try to analyze your top spending categories.`,
      };
    }
    return {
      title: "Focus on Savings",
      message: "Your expenses are higher than your income this month. Let's find areas to cut back.",
    };
  };

  const savingsAdvice = getSavingsAdvice();

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="text-yellow-500" />
          <span>Financial Advice</span>
        </CardTitle>
        <CardDescription>
          Personalized tips based on your activity this month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Wallet />
            <h4 className="text-md">{savingsAdvice.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            {savingsAdvice.message}
          </p>
        </div>

        {totalExpense > 0 && (
          <div>
            <div className="flex items-center gap-2 font-semibold">
                <TrendingDown />
                <h4 className="text-md">Top Spending Categories</h4>
            </div>
            <ul className="list-disc pl-12 text-sm text-muted-foreground space-y-1 mt-1">
              {topCategories.map(([category, amount]) => (
                <li key={category}>
                  <strong>{category}:</strong> {formatCurrency(amount)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Target />
            <h4 className="text-md">Tips for Reducing Expenses</h4>
          </div>
          <ul className="list-disc pl-12 text-sm text-muted-foreground space-y-1 mt-1">
            <li>Review your top categories. Can you find cheaper alternatives or reduce frequency?</li>
            <li>Look for subscriptions you no longer use and cancel them.</li>
            <li>Try setting a budget for your top 3 spending categories next month.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
