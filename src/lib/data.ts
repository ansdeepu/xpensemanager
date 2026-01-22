
import type { LucideIcon } from 'lucide-react';

export type Account = {
  id: string;
  userId: string;
  name: string;
  balance: number;
  icon: string;
  purpose: string;
  type?: 'bank' | 'card';
  isPrimary?: boolean;
  order: number;
  actualBalance?: number;
  actualBalanceDate?: string;
  limit?: number | null;
};

export type Bill = {
  id: string;
  userId: string;
  title: string;
  amount: number;
  dueDate: string;
  paidOn?: string;
  type: 'bill' | 'special_day';
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'occasional';
  selectedMonths?: string[];
}

export type Transaction = {
  id:string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  paymentMethod?: "cash" | "digital" | "online";
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  category: string;
  categoryId?: string;
  subcategory?: string;
  loanTransactionId?: string; // Link to the specific transaction in a loan document
};

export type SubCategory = {
  id: string; // Unique ID for each subcategory
  name: string;
  order?: number;
  amount?: number;
  frequency?: 'monthly' | 'occasional';
  selectedMonths?: string[];
}

export type Category = {
  id: string;
  userId: string;
  name: string;
  icon: string;
  subcategories: SubCategory[];
  order: number;
  type: 'expense' | 'income' | 'bank-expense';
};

export type LoanTransaction = {
  id: string;
  date: string;
  amount: number;
  type: 'loan' | 'repayment';
  accountId: string; // which bank/cash/digital account was used
  description?: string;
};

export type Loan = {
  id: string;
  userId: string;
  personName: string;
  type: 'taken' | 'given';
  totalLoan: number;
  totalRepayment: number;
  balance: number;
  transactions: LoanTransaction[];
}


// The following are mock data and will be replaced by Firestore data.
// We keep them here for reference and for components that haven't been migrated yet.
export const accounts: Account[] = [];

export const transactions: Transaction[] = [];

export const categories: Category[] = [];

    