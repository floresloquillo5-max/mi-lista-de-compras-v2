/**
 * @jest-environment jsdom
 */
import { $empty, debounce, truncate, showConfirmModal } from '../dom';

describe('dom utilities', () => {
  describe('$empty', () => {
    test('removes all children from element', () => {
      const parent = document.createElement('div');
      parent.appendChild(document.createElement('span'));
      parent.appendChild(document.createElement('span'));
      expect(parent.childNodes.length).toBe(2);
      $empty(parent);
      expect(parent.childNodes.length).toBe(0);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('passes arguments', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('hello', 42);
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('hello', 42);
    });
  });

  describe('truncate', () => {
    test('returns string unchanged when under max', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    test('truncates string when over max', () => {
      expect(truncate('hello world', 5)).toBe('hello');
    });

    test('handles empty string', () => {
      expect(truncate('', 5)).toBe('');
    });

    test('handles exact max length', () => {
      expect(truncate('abc', 3)).toBe('abc');
    });
  });
});
