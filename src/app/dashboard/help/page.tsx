import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shapes, Landmark, ArrowRightLeft, ListChecks } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">How to Use Expense Manager</h1>
        <p className="text-muted-foreground">
          A step-by-step guide to get started with managing your finances.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks />
            <span>Getting Started Checklist</span>
          </CardTitle>
          <CardDescription>Follow these steps to set up your account and start tracking your expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Shapes className="h-5 w-5 text-primary" />
                  <span>Step 1: Create Categories</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                <p className="mb-4">
                  Categories help you organize your financial activities. Before you start adding transactions, it's best to set up your categories.
                </p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Navigate to the <strong>Categories</strong> page from the sidebar.</li>
                  <li>You will see two tabs: <strong>Expense Categories</strong> and <strong>Bank Categories</strong>.</li>
                  <li>In each tab, click the "Add... Category" button to create main categories (e.g., "Food", "Transport", "Salary").</li>
                  <li>Once a category is created, you can add sub-categories to it (e.g., "Groceries", "Restaurants" under "Food").</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Landmark className="h-5 w-5 text-primary" />
                  <span>Step 2: Add Bank Accounts</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                 <p className="mb-4">
                  Add all your financial accounts to keep track of your balances in one place.
                </p>
                 <ol className="list-decimal list-inside space-y-2">
                  <li>Go to the <strong>Bank Accounts</strong> page.</li>
                  <li>Click the "Add Account" button.</li>
                  <li>Fill in the details for your account, such as the name (e.g., "Main Savings") and its purpose.</li>
                  <li>The first account you add will be set as your primary account by default.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  <span>Step 3: Record Daily Transactions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                 <p className="mb-4">
                  Log your daily financial activities to see where your money is going.
                </p>
                 <ol className="list-decimal list-inside space-y-2">
                  <li>Go to the <strong>Transactions</strong> page.</li>
                  <li>Click on "Add Transaction".</li>
                  <li>You can add three types of transactions:
                    <ul className="list-disc list-inside pl-6 mt-2 space-y-1">
                      <li><strong>Income:</strong> Any money you receive. Select the bank account where the money was deposited.</li>
                      <li><strong>Expense:</strong> Any money you spend. Choose whether you paid from a bank account or your cash "Wallet".</li>
                      <li><strong>Transfer:</strong> Moving money between your own accounts (e.g., from a bank account to your Wallet).</li>
                    </ul>
                  </li>
                   <li>Fill in the description, amount, date, and assign it to a category and sub-category.</li>
                   <li>Your account balances and financial summaries will update automatically.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
