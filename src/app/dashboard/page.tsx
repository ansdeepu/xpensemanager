
"use client";

import React from "react";
import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { CurrentMonthDailyExpenses } from "@/components/dashboard/overview/current-month-daily-expenses";
import { DateWiseExpenses } from "@/components/dashboard/overview/date-wise-expenses";
import { LoanSummary } from "@/components/dashboard/overview/loan-summary";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";

export default function DashboardPage(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  // Use React.use() to satisfy Next.js 15 async props requirements
  const params = React.use(props.params);
  const searchParams = React.use(props.searchParams);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AccountBalances />
        <NoticeBoard />
      </div>
      <LoanSummary />
      <CategoryExpenses />
      <CurrentMonthDailyExpenses />
      <DateWiseExpenses />
    </div>
  );
}
