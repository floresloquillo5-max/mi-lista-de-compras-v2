export interface Product {
  id: number;
  name: string;
  qty: number;
  unit: string;
  price: number;
  checked: boolean;
  barcode?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  products: Product[];
  createdAt: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'income' | 'expense' | 'egreso';
  category: string;
  amountUSD: number;
  amountBS: number;
  currency: 'USD' | 'BS';
  description: string;
}

export interface SavingsGoal {
  amountUSD: number;
  description: string;
  currency: 'USD' | 'BS';
  originalAmount: number;
  contributions: SavingsContribution[];
}

export interface SavingsContribution {
  id: number;
  amount: number;
  currency: 'USD' | 'BS';
  description: string;
  date: string;
}

export interface Debt {
  id: number;
  description: string;
  totalAmount: number;
  currency: 'USD' | 'BS';
  category: string;
  installments: number;
  paidAmount: number;
  date: string;
  payments: DebtPayment[];
}

export interface DebtPayment {
  amount: number;
  date: string;
}

export interface BackupData {
  version: string;
  marketLists: Record<string, ShoppingList>;
  currentListId: string;
  transactions: Transaction[];
  savingsGoal: SavingsGoal | null;
  dollarRate: number;
  theme: 'dark' | 'light';
  notificationPrefs: NotificationPrefs | null;
  debts: Debt[];
}

export interface NotificationPrefs {
  enabled: boolean;
  time: string;
  day: string;
}
