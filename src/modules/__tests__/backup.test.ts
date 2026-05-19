import type { BackupData } from '../../types';

function validateBackupData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { valid: false, error: 'No es un objeto' };
  const d = data as Record<string, unknown>;

  if (typeof d.marketLists !== 'object' || d.marketLists === null) return { valid: false, error: 'marketLists inválido' };
  if (typeof d.currentListId !== 'string') return { valid: false, error: 'currentListId inválido' };
  if (!Array.isArray(d.transactions)) return { valid: false, error: 'transactions inválido' };
  if (d.savingsGoal !== null && typeof d.savingsGoal !== 'object') return { valid: false, error: 'savingsGoal inválido' };
  if (typeof d.dollarRate !== 'number') return { valid: false, error: 'dollarRate inválido' };

  for (const list of Object.values(d.marketLists as Record<string, unknown>)) {
    const l = list as Record<string, unknown>;
    if (typeof l.id !== 'string' || typeof l.name !== 'string' || !Array.isArray(l.products)) {
      return { valid: false, error: 'Estructura de lista inválida' };
    }
  }

  return { valid: true };
}

describe('Backup validation', () => {
  const validBackup: BackupData = {
    version: '3.0',
    marketLists: {
      default: { id: 'default', name: 'Mi Lista', products: [], createdAt: '2026-01-01' }
    },
    currentListId: 'default',
    transactions: [],
    savingsGoal: null,
    dollarRate: 50,
    theme: 'dark',
    notificationPrefs: null,
    debts: [],
  };

  test('valid backup passes', () => {
    expect(validateBackupData(validBackup).valid).toBe(true);
  });

  test('missing marketLists fails', () => {
    const bad = { ...validBackup, marketLists: null };
    expect(validateBackupData(bad).valid).toBe(false);
  });

  test('invalid currentListId fails', () => {
    const bad = { ...validBackup, currentListId: 123 };
    expect(validateBackupData(bad).valid).toBe(false);
  });

  test('missing transactions fails', () => {
    const bad = { ...validBackup, transactions: null };
    expect(validateBackupData(bad).valid).toBe(false);
  });

  test('invalid dollarRate fails', () => {
    const bad = { ...validBackup, dollarRate: '50' };
    expect(validateBackupData(bad).valid).toBe(false);
  });

  test('null backup fails', () => {
    expect(validateBackupData(null).valid).toBe(false);
  });

  test('invalid list structure fails', () => {
    const bad = {
      ...validBackup,
      marketLists: { bad: { id: 123, name: true, products: 'no' } }
    };
    expect(validateBackupData(bad).valid).toBe(false);
  });
});
