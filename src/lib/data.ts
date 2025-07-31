import type { LucideIcon } from 'lucide-react';

export type Account = {
  id: string;
  userId: string;
  name: string;
  balance: number;
  icon: string;
  purpose: string;
  isPrimary?: boolean;
  order: number;
};

export type Bill = {
  id: string;
  userId: string;
  title: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly';
}

export type Transaction = {
  id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  paymentMethod?: "wallet" | "online";
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  category: string;
  subcategory?: string;
};

export type SubCategory = {
  id: string; // Unique ID for each subcategory
  name: string;
  order?: number;
  amount?: number;
  frequency?: 'monthly' | 'occasional';
}

export type Category = {
  id: string;
  userId: string;
  name: string;
  icon: string;
  subcategories: SubCategory[];
  order: number;
  type: 'expense' | 'bank' | 'income';
};


// The following are mock data and will be replaced by Firestore data.
// We keep them here for reference and for components that haven't been migrated yet.
export const accounts: Account[] = [];

export const transactions: Transaction[] = [];

export const categories: Category[] = [];
