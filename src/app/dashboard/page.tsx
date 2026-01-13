
import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { CurrentMonthDailyExpenses } from "@/components/dashboard/overview/current-month-daily-expenses";
import { DateWiseExpenses } from "@/components/dashboard/overview/date-wise-expenses";
import { LoanSummary } from "@/components/dashboard/overview/loan-summary";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
           <AccountBalances />
        </div>
        <div className="lg:col-span-2">
           <NoticeBoard />
        </div>
      </div>
      <LoanSummary />
      <CategoryExpenses />
      <CurrentMonthDailyExpenses />
      <DateWiseExpenses />
    </div>
  );
}
