import { AppState } from '../state';
import { LOCAL_STORAGE_KEYS } from '../config/constants';
import type { BackupData, Debt, NotificationPrefs, Product, SavingsGoal, ShoppingList, Transaction } from '../types';

function safeGetItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadLists(): void {
  const saved = safeGetItem<Record<string, ShoppingList>>(LOCAL_STORAGE_KEYS.marketLists);
  if (saved) AppState.state.marketLists = saved;

  if (!AppState.state.marketLists['default']) {
    const oldProducts = safeGetItem<Product[]>(LOCAL_STORAGE_KEYS.oldMarketProducts);
    AppState.state.marketLists['default'] = {
      id: 'default',
      name: 'Mi Lista',
      products: oldProducts || [],
      createdAt: new Date().toISOString(),
    };
    saveLists();
  }

  const savedListId = safeGetItem<string>(LOCAL_STORAGE_KEYS.currentListId);
  if (savedListId && AppState.state.marketLists[savedListId]) {
    AppState.state.currentListId = savedListId;
  } else {
    AppState.state.currentListId = 'default';
    safeSetItem(LOCAL_STORAGE_KEYS.currentListId, 'default');
  }
}

export function saveLists(): void {
  safeSetItem(LOCAL_STORAGE_KEYS.marketLists, AppState.state.marketLists);
}

export function persistCurrentListId(): void {
  safeSetItem(LOCAL_STORAGE_KEYS.currentListId, AppState.state.currentListId);
}

export function loadFinanceData(): void {
  const saved = safeGetItem<Transaction[]>(LOCAL_STORAGE_KEYS.transactions);
  if (saved) AppState.state.transactions = saved;

  const raw = safeGetItem<SavingsGoal | number>(LOCAL_STORAGE_KEYS.savingsGoal);
  if (raw !== null) {
    if (typeof raw === 'number') {
      AppState.state.savingsGoalData = {
        amountUSD: raw,
        description: '',
        currency: 'USD',
        originalAmount: raw,
        contributions: [],
      };
    } else {
      AppState.state.savingsGoalData = raw as SavingsGoal;
    }
  }

  const debts = safeGetItem<Debt[]>(LOCAL_STORAGE_KEYS.debts);
  if (debts) AppState.state.debts = debts;
}

export function saveFinanceData(): void {
  safeSetItem(LOCAL_STORAGE_KEYS.transactions, AppState.state.transactions);
  safeSetItem(LOCAL_STORAGE_KEYS.savingsGoal, AppState.state.savingsGoalData);
  safeSetItem(LOCAL_STORAGE_KEYS.debts, AppState.state.debts);
}

export function loadSavedRate(): void {
  const savedRate = safeGetItem<string>(LOCAL_STORAGE_KEYS.dollarRate);
  const savedDate = safeGetItem<string>(LOCAL_STORAGE_KEYS.lastUpdate);
  const display = document.getElementById('rateDisplay');
  const lastUpdate = document.getElementById('lastUpdate');

  if (savedRate && parseFloat(savedRate) > 0) {
    AppState.state.settings.dollarRate = parseFloat(savedRate);
    if (display) {
      display.classList.remove('skeleton');
      display.classList.remove('rate-online');
      display.classList.add('rate-offline');
      display.textContent = `Bs. ${formatNumber(parseFloat(savedRate))} (guardada)`;
    }
    if (savedDate && lastUpdate) {
      const d = new Date(savedDate);
      lastUpdate.textContent = `Tasa guardada del: ${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } else {
    AppState.state.settings.dollarRate = 0;
    if (display) {
      display.classList.remove('skeleton');
      display.classList.remove('rate-online');
      display.classList.add('rate-offline');
      display.textContent = 'Sin tasa';
    }
    if (lastUpdate) lastUpdate.textContent = 'No se pudo obtener la tasa. Conéctate a internet.';
  }
}

export function saveRate(rate: number): void {
  AppState.state.settings.dollarRate = rate;
  safeSetItem(LOCAL_STORAGE_KEYS.dollarRate, String(rate));
  safeSetItem(LOCAL_STORAGE_KEYS.lastUpdate, new Date().toISOString());
}

export function loadTheme(): string {
  const theme = safeGetItem<string>(LOCAL_STORAGE_KEYS.theme) || 'dark';
  AppState.state.settings.theme = theme as 'dark' | 'light';
  return theme;
}

export function saveTheme(theme: string): void {
  AppState.state.settings.theme = theme as 'dark' | 'light';
  safeSetItem(LOCAL_STORAGE_KEYS.theme, theme);
}

export function loadNotificationPrefs(): NotificationPrefs | null {
  const prefs = safeGetItem<NotificationPrefs>(LOCAL_STORAGE_KEYS.notificationPrefs);
  return prefs;
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  safeSetItem(LOCAL_STORAGE_KEYS.notificationPrefs, prefs);
}

export function saveAllBackupData(data: BackupData): void {
  safeSetItem(LOCAL_STORAGE_KEYS.marketLists, data.marketLists);
  safeSetItem(LOCAL_STORAGE_KEYS.currentListId, data.currentListId);
  safeSetItem(LOCAL_STORAGE_KEYS.transactions, data.transactions);
  safeSetItem(LOCAL_STORAGE_KEYS.savingsGoal, data.savingsGoal);
  safeSetItem(LOCAL_STORAGE_KEYS.dollarRate, String(data.dollarRate));
  safeSetItem(LOCAL_STORAGE_KEYS.notificationPrefs, data.notificationPrefs);
  safeSetItem(LOCAL_STORAGE_KEYS.debts, data.debts);
  safeSetItem(LOCAL_STORAGE_KEYS.theme, data.theme);
}

export function clearAllData(): void {
  Object.values(LOCAL_STORAGE_KEYS).forEach(key => safeRemoveItem(key));
}

import { formatNumber } from './format';

// needed for loadSavedRate's display
