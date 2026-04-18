
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Shapes, 
  Landmark, 
  ArrowRightLeft, 
  ListChecks, 
  Upload, 
  Printer, 
  MousePointerClick, 
  Wallet, 
  Coins, 
  History,
  Activity,
  Zap
} from "lucide-react";

export default function HelpPage() {
  return (
    <div className="space-y-6">
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
              <AccordionContent className="pl-8 space-y-4">
                <div>
                  <p className="mb-4">
                    Categories help you organize your financial activities. You can add them manually or import them from an Excel file. Each sub-category is automatically assigned a serial number for easy tracking.
                  </p>
                  <h4 className="font-semibold mb-2">Manually Creating Categories:</h4>
                  <ol className="list-decimal list-inside space-y-2 mb-4">
                    <li>Navigate to the <strong>Categories</strong> page from the sidebar.</li>
                    <li>You will see tabs for <strong>Expense</strong>, <strong>Income</strong>, and <strong>Bank Expense</strong> categories.</li>
                    <li>Click the "Add Category" button to create main categories (e.g., "Food", "Transport").</li>
                    <li>Once a category is created, you can add sub-categories to it.</li>
                  </ol>
                  <h4 className="font-semibold mb-2">Monthly vs. Occasional Expenses:</h4>
                   <p className="text-sm text-muted-foreground mb-4">
                        For expense categories, you can define sub-categories as either <strong>monthly</strong> (recurring) or <strong>occasional</strong> (specific months). This helps calculate an accurate budget total, which is displayed on the category card.
                    </p>
                </div>

                <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Upload className="h-4 w-4" />Importing from Excel:</h4>
                    <p className="mb-4">To quickly add many categories and sub-categories at once, use the import feature.</p>
                     <ol className="list-decimal list-inside space-y-2 mb-4">
                        <li>Click <strong>Import from Excel</strong> on the Categories page.</li>
                        <li>Select your `.xlsx` or `.xls` file.</li>
                    </ol>
                    <p className="mb-2 font-medium">Excel File Format:</p>
                    <p className="text-sm text-muted-foreground mb-4">The first row contains main categories. Rows below in the same column are sub-categories. Imported items are "occasional" by default.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Landmark className="h-5 w-5 text-primary" />
                  <span>Step 2: Bank Accounts & Ecosystem</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                 <p className="mb-4">
                  Add all your financial accounts to keep track of your balances in one place.
                </p>
                 <ol className="list-decimal list-inside space-y-2">
                  <li>Go to <strong>Bank Accounts</strong> to manage your accounts.</li>
                  <li>Click <strong>Add Account</strong> to add a bank or credit card.</li>
                  <li className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-1 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <span><strong>Ecosystem Total:</strong> This represents your liquid assets. It is the sum of your <strong>Primary Bank Balance + Cash Wallet + Digital Wallet</strong>. Credit card debt is displayed for reference but is not subtracted from this total.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MousePointerClick className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <span>Click on any account card in the Dashboard to see its full transaction passbook history.</span>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  <span>Step 3: Advanced Transaction Tracking</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8 space-y-4">
                 <p>
                  Log daily activities to see where your money goes. The Transactions page now features advanced visibility tools:
                </p>
                 <ol className="list-decimal list-inside space-y-3">
                  <li>
                    <strong>Split Transactions:</strong> When adding an expense, you can add multiple items. These will appear in the table with <strong>itemized descriptions and amounts</strong> on separate lines, giving you full visibility without extra clicks.
                  </li>
                  <li className="flex items-start gap-2">
                    <History className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <span><strong>Historical Snapshots:</strong> In the "Primary" tab of the Transactions page, the <strong>Balance</strong> column is clickable. Clicking a balance opens a window showing exactly how your Bank, Cash, and Digital balances were distributed at that point in time.</span>
                  </li>
                   <li className="flex items-start gap-2">
                     <Printer className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <span>To print a report, filter the transactions by date or search query, then click the <strong>Print</strong> button.</span>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Step 4: Automated Bill Tracking</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                 <p className="mb-4">
                  The <strong>Bills & Events</strong> page tracks upcoming due dates.
                </p>
                 <ul className="list-disc list-inside space-y-2">
                  <li><strong>Smart Matching:</strong> The system automatically finds the "Last Payment Date" by scanning your transactions. It is smart enough to look inside split/multi-entry transactions to find your bill payments.</li>
                  <li><strong>Recurrence:</strong> Set bills as Monthly, Quarterly, or Yearly to see automated "Next Due Dates".</li>
                  <li><strong>Notice Board:</strong> Check the Dashboard's Notice Board for alerts on bills due within 10 days and special events in the next 5 days.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
