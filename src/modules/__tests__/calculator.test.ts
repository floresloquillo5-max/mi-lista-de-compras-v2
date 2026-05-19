import { CASHEA_LEVELS } from '../../config/constants';
import { formatUSD } from '../../utils/format';

/* Pure calculation tests — these functions would be extracted
   from the DOM-dependent calculator module for pure testing */

function calculateCoveragePure(total: number, level: number): {
  casheaFinances: number;
  userPayment: number;
} {
  const percent = CASHEA_LEVELS[level] || 0.50;
  const casheaFinances = total * percent;
  const userPayment = total - casheaFinances;
  return { casheaFinances, userPayment };
}

function calculateImaginaryPure(capital: number, remain: number, level: number): {
  purchaseAmount: number;
  casheaFinances: number;
  userPayment: number;
} {
  const percent = CASHEA_LEVELS[level] || 0.50;
  const purchaseAmount = (capital - remain) / (1 - percent);
  const casheaFinances = purchaseAmount * percent;
  const userPayment = purchaseAmount - casheaFinances;
  return { purchaseAmount, casheaFinances, userPayment };
}

describe('Calculator pure logic', () => {
  describe('CASHEA_LEVELS', () => {
    test('level 1 is 40%', () => {
      expect(CASHEA_LEVELS[1]).toBe(0.40);
    });
    test('level 2 is 50%', () => {
      expect(CASHEA_LEVELS[2]).toBe(0.50);
    });
    test('level 3 is 60%', () => {
      expect(CASHEA_LEVELS[3]).toBe(0.60);
    });
  });

  describe('calculateCoveragePure', () => {
    test('level 2 with $80 total: user pays $40, Cashea finances $40', () => {
      const result = calculateCoveragePure(80, 2);
      expect(result.casheaFinances).toBe(40);
      expect(result.userPayment).toBe(40);
    });

    test('level 3 with $100 total: user pays $40, Cashea finances $60', () => {
      const result = calculateCoveragePure(100, 3);
      expect(result.casheaFinances).toBe(60);
      expect(result.userPayment).toBe(40);
    });

    test('level 1 with $50 total', () => {
      const result = calculateCoveragePure(50, 1);
      expect(result.casheaFinances).toBe(20);
      expect(result.userPayment).toBe(30);
    });
  });

  describe('calculateImaginaryPure', () => {
    test('level 2, capital $100, remain $25', () => {
      const result = calculateImaginaryPure(100, 25, 2);
      expect(result.purchaseAmount).toBe(150);
      expect(result.casheaFinances).toBe(75);
      expect(result.userPayment).toBe(75);
    });

    test('level 3, capital $200, remain $50', () => {
      const result = calculateImaginaryPure(200, 50, 3);
      expect(result.purchaseAmount).toBeCloseTo(375, 1);
      expect(result.casheaFinances).toBeCloseTo(225, 1);
      expect(result.userPayment).toBeCloseTo(150, 1);
    });
  });

  describe('formatUSD', () => {
    test('formats imaginary result', () => {
      expect(formatUSD(150)).toBe('$150.00');
    });
  });
});
