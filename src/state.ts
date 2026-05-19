import type { Debt, Product, SavingsGoal, ShoppingList, Transaction } from './types';

interface AppSettings {
  theme: 'dark' | 'light';
  dollarRate: number;
}

interface AppStateShape {
  marketLists: Record<string, ShoppingList>;
  currentListId: string;
  transactions: Transaction[];
  savingsGoalData: SavingsGoal | null;
  debts: Debt[];
  settings: AppSettings;
  scannerStream: MediaStream | null;
  scannerActive: boolean;
  notificationReminderInterval: ReturnType<typeof setInterval> | null;
  promptCallback: ((val: string) => void) | null;
  confirmCallback: (() => void) | null;
  calendarViewDate: Date;
  selectedCalDay: string | null;
  quickFormActive: boolean;
}

type Listener = () => void;

class Store {
  private _state: AppStateShape;
  private _listeners: Set<Listener> = new Set();

  constructor() {
    this._state = {
      marketLists: {},
      currentListId: 'default',
      transactions: [],
      savingsGoalData: null,
      debts: [],
      settings: { theme: 'dark', dollarRate: 0 },
      scannerStream: null,
      scannerActive: false,
      notificationReminderInterval: null,
      promptCallback: null,
      confirmCallback: null,
      calendarViewDate: new Date(),
      selectedCalDay: null,
      quickFormActive: false,
    };
  }

  get state(): AppStateShape {
    return this._state;
  }

  get<K extends keyof AppStateShape>(key: K): AppStateShape[K] {
    return this._state[key];
  }

  set<K extends keyof AppStateShape>(key: K, value: AppStateShape[K]): void {
    this._state[key] = value;
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  notify(): void {
    this._listeners.forEach(fn => fn());
  }

  getCurrentList(): ShoppingList {
    if (!this._state.marketLists[this._state.currentListId]) {
      this._state.currentListId = 'default';
    }
    return this._state.marketLists[this._state.currentListId];
  }

  getProducts(): Product[] {
    return this.getCurrentList().products || [];
  }

  setProducts(arr: Product[]): void {
    this.getCurrentList().products = arr;
    this.notify();
  }
}

export const AppState = new Store();
