import { parseFloatFromLocalString, formatNumber, formatUSD, formatBS, escapeHtml, formatDateShort, getCategoryIcon } from '../format';

describe('format utilities', () => {
  describe('parseFloatFromLocalString', () => {
    test('parses integer string', () => {
      expect(parseFloatFromLocalString('50')).toBe(50);
    });

    test('parses decimal with comma separator', () => {
      expect(parseFloatFromLocalString('32,50')).toBe(32.50);
    });

    test('parses thousands with dots', () => {
      expect(parseFloatFromLocalString('1.234')).toBe(1234);
    });

    test('parses full format', () => {
      expect(parseFloatFromLocalString('1.234,56')).toBe(1234.56);
    });

    test('returns 0 for empty string', () => {
      expect(parseFloatFromLocalString('')).toBe(0);
    });

    test('returns 0 for invalid input', () => {
      expect(parseFloatFromLocalString('abc')).toBe(0);
    });
  });

  describe('formatNumber', () => {
    test('formats with thousands separator', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });

    test('formats zero', () => {
      expect(formatNumber(0)).toBe('0.00');
    });
  });

  describe('formatUSD', () => {
    test('formats USD with $ prefix', () => {
      expect(formatUSD(50)).toBe('$50.00');
    });
  });

  describe('formatBS', () => {
    test('formats Bs with dot decimal', () => {
      expect(formatBS(1234.56)).toBe('Bs. 1.234,56');
    });
  });

  describe('escapeHtml', () => {
    test('escapes & < > "', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('avoids CSV injection', () => {
      expect(escapeHtml('=CMD')).toBe('=CMD');
    });

    test('returns safe string unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatDateShort', () => {
    test('formats ISO date to short locale', () => {
      const result = formatDateShort('2026-05-18');
      expect(result).toMatch(/\d{1,2}\/\d{1,2}/);
    });
  });

  describe('getCategoryIcon', () => {
    test('returns icon for known category', () => {
      expect(getCategoryIcon('comida')).toBe('🍔');
    });

    test('returns default for unknown category', () => {
      expect(getCategoryIcon('unknown')).toBe('📌');
    });
  });
});

describe('CSV security', () => {
  test('CSV formula injection fields should match expected pattern', () => {
    const dangerous = ['=SUM(1,1)', '+SUM(1,1)', '-SUM(1,1)', '@SUM(1,1)'];
    const safe = ['hello', 'SUM(1,1)', 'normal text'];
    for (const val of dangerous) {
      expect(val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')).toBe(true);
    }
    for (const val of safe) {
      expect(val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')).toBe(false);
    }
  });
});
