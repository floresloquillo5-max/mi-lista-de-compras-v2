import { AppState } from '../state';
import { saveFinanceData } from '../utils/storage';
import { escapeHtml, formatUSD, formatDateShort, getCategoryIcon, parseFloatFromLocalString } from '../utils/format';
import { $, $empty, showToast, downloadFile, truncate } from '../utils/dom';
import type { Transaction } from '../types';

let txIdCounter = Date.now();
function nextTxId(): number { return ++txIdCounter; }

export function renderCalendar(): void {
  const grid = document.getElementById('calGrid');
  if (!grid) return;

  const date = AppState.state.calendarViewDate;
  const year = date.getFullYear();
  const month = date.getMonth();

  const title = document.getElementById('calTitle');
  if (title) title.textContent = date.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const txs = AppState.state.transactions;
  const dayData: Record<number, { income: number; expense: number; count: number }> = {};
  txs.forEach(tx => {
    const d = new Date(tx.date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (!dayData[d.getDate()]) dayData[d.getDate()] = { income: 0, expense: 0, count: 0 };
      dayData[d.getDate()].count++;
      if (tx.type === 'income') dayData[d.getDate()].income += tx.amountUSD;
      else dayData[d.getDate()].expense += tx.amountUSD;
    }
  });

  $empty(grid);
  const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  weekdays.forEach(d => {
    const el = document.createElement('span');
    el.className = 'cal-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('span');
    el.className = 'cal-day cal-other-month';
    el.textContent = String(daysInPrev - firstDay + 1 + i);
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const el = document.createElement('span');
    el.className = 'cal-day';
    el.dataset.day = String(day);
    el.textContent = String(day);

    const data = dayData[day];
    if (data) {
      if (data.income > 0 && data.expense > 0) {
        el.style.background = 'linear-gradient(135deg, #27ae60, #e74c3c)';
      } else if (data.income > 0) {
        el.style.background = '#27ae60';
      } else {
        const intensity = Math.min(1, data.expense / 100);
        const r = Math.round(231 - intensity * 100);
        const g = Math.round(76 + intensity * 30);
        const b = Math.round(60 - intensity * 20);
        el.style.background = `rgb(${r}, ${g}, ${b})`;
      }
      el.classList.add('cal-has-data');
    }
    grid.appendChild(el);
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const el = document.createElement('span');
    el.className = 'cal-day cal-other-month';
    el.textContent = String(i);
    grid.appendChild(el);
  }

  resetDayPanel();
  updateCalendarSummary();
}

function getCalendarMonthData(): Transaction[] {
  const date = AppState.state.calendarViewDate;
  return AppState.state.transactions.filter(tx => {
    const d = new Date(tx.date + 'T12:00:00');
    return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });
}

export function navigateCalendar(direction: number): void {
  const date = AppState.state.calendarViewDate;
  date.setMonth(date.getMonth() + direction);
  renderCalendar();
  updateCalendarSummary();
}

function resetDayPanel(): void {
  AppState.state.selectedCalDay = null;
  const dayList = document.getElementById('calDayList');
  if (dayList) {
    dayList.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Toca un día del calendario para ver sus transacciones.</p></div>';
  }
  const dayTitle = document.getElementById('calDayTitle');
  if (dayTitle) dayTitle.textContent = 'Registrar movimiento del día';
  const dayTotals = document.getElementById('calDayTotals');
  if (dayTotals) dayTotals.innerHTML = '';
  const dayCount = document.getElementById('calDayCount');
  if (dayCount) dayCount.textContent = '';
}

export function selectCalendarDay(dayEl: HTMLElement): void {
  const day = dayEl.dataset.day;
  if (!day) return;

  AppState.state.selectedCalDay = day;
  const date = AppState.state.calendarViewDate;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(parseInt(day)).padStart(2, '0')}`;

  const dayTxs = AppState.state.transactions.filter(tx => tx.date === dateStr);

  const dayTitle = document.getElementById('calDayTitle');
  if (dayTitle) dayTitle.textContent = `📅 ${parseInt(day)} de ${date.toLocaleDateString('es-VE', { month: 'long' })}`;

  const dayCount = document.getElementById('calDayCount');
  if (dayCount) dayCount.textContent = dayTxs.length > 0 ? `${dayTxs.length} mov.` : '';

  const dayTotals = document.getElementById('calDayTotals');
  if (dayTotals) {
    const income = dayTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amountUSD, 0);
    const expense = dayTxs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').reduce((s, tx) => s + tx.amountUSD, 0);
    dayTotals.innerHTML = `
      <span class="cal-day-total income">💰 ${formatUSD(income)}</span>
      <span class="cal-day-total expense">💸 ${formatUSD(expense)}</span>
    `;
  }

  const dayList = document.getElementById('calDayList');
  if (dayList) {
    if (dayTxs.length === 0) {
      dayList.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Sin movimientos este día.</p></div>';
    } else {
      dayList.innerHTML = dayTxs.map(tx => `
        <div class="cal-day-item" data-txid="${tx.id}">
          <span class="cal-day-item-icon">${getCategoryIcon(tx.category)}</span>
          <span class="cal-day-item-desc">${escapeHtml(tx.description || tx.category)}</span>
          <span class="cal-day-item-amount ${tx.type === 'income' ? 'income' : 'expense'}">${formatUSD(tx.amountUSD)}</span>
          <button class="history-delete" data-txid="${tx.id}" title="Eliminar">🗑️</button>
        </div>
      `).join('');
    }
  }
}

export function deleteFromCalendar(txId: number): void {
  AppState.state.transactions = AppState.state.transactions.filter(tx => tx.id !== txId);
  saveFinanceData();
  const day = AppState.state.selectedCalDay;
  if (day) {
    const dayEl = document.querySelector(`.cal-day[data-day="${day}"]`) as HTMLElement | null;
    if (dayEl) selectCalendarDay(dayEl);
  }
  updateCalendarSummary();
  showToast('🗑️ Movimiento eliminado');
}

function updateCalendarSummary(): void {
  const monthTxs = getCalendarMonthData();
  const income = monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amountUSD, 0);
  const expense = monthTxs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').reduce((s, tx) => s + tx.amountUSD, 0);

  const calIncome = document.getElementById('calIncome');
  const calExpense = document.getElementById('calExpense');
  const calBalance = document.getElementById('calBalance');

  if (calIncome) calIncome.textContent = formatUSD(income);
  if (calExpense) calExpense.textContent = formatUSD(expense);
  if (calBalance) {
    const balance = income - expense;
    calBalance.textContent = formatUSD(balance);
    calBalance.className = 'cal-summary-value cal-balance';
  }
}

export function toggleQuickForm(): void {
  const form = document.getElementById('calQuickForm');
  if (!form) return;
  AppState.state.quickFormActive = !AppState.state.quickFormActive;
  form.classList.toggle('visible', AppState.state.quickFormActive);
}

export function closeQuickForm(): void {
  const form = document.getElementById('calQuickForm');
  if (form) form.classList.remove('visible');
  AppState.state.quickFormActive = false;
}

export function saveQuickTransaction(): void {
  const day = AppState.state.selectedCalDay;
  if (!day) { showToast('⚠️ Selecciona un día primero'); return; }

  const type = document.getElementById('qfType') as HTMLSelectElement | null;
  const category = document.getElementById('qfCategory') as HTMLSelectElement | null;
  const amount = document.getElementById('qfAmount') as HTMLInputElement | null;
  const currency = document.getElementById('qfCurrency') as HTMLSelectElement | null;
  const desc = document.getElementById('qfDesc') as HTMLInputElement | null;

  if (!type || !category || !amount || !currency) return;

  const amt = parseFloatFromLocalString(amount.value);
  if (amt <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

  const date = AppState.state.calendarViewDate;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(parseInt(day)).padStart(2, '0')}`;
  const rate = AppState.state.settings.dollarRate;

  const tx: Transaction = {
    id: nextTxId(),
    date: dateStr,
    type: type.value as Transaction['type'],
    category: category.value,
    amountUSD: currency.value === 'USD' ? amt : amt / (rate || 1),
    amountBS: currency.value === 'BS' ? amt : amt * rate,
    currency: currency.value as 'USD' | 'BS',
    description: truncate(desc ? desc.value.trim() : '', 100),
  };

  AppState.state.transactions.push(tx);
  saveFinanceData();
  renderCalendar();
  updateCalendarSummary();
  closeQuickForm();
  if (amount) amount.value = '';
  if (desc) desc.value = '';
  window.dispatchEvent(new CustomEvent('finance:updated'));
  showToast('✅ Movimiento agregado');
}

export function exportCalendarMonth(): void {
  const monthTxs = getCalendarMonthData();
  if (monthTxs.length === 0) { showToast('⚠️ No hay datos este mes'); return; }

  const date = AppState.state.calendarViewDate;
  const monthYear = date.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).replace(/ /g, '_');
  function escCsv(val: string): string {
    const escaped = val.replace(/"/g, '""');
    return escaped.startsWith('=') || escaped.startsWith('+') || escaped.startsWith('-') || escaped.startsWith('@')
      ? "'" + escaped
      : escaped;
  }
  const header = 'Fecha,Tipo,Categoría,Monto USD,Descripción';
  const rows = monthTxs.map(tx =>
    `${tx.date},${tx.type},${tx.category},${tx.amountUSD.toFixed(2)},"${escCsv(tx.description || '')}"`
  ).join('\n');

  downloadFile(header + '\n' + rows, `calendario_${monthYear}.csv`, 'text/csv');
  showToast('✅ Mes exportado');
}

export function toggleMonthPicker(): void {
  const picker = document.getElementById('calMonthPicker');
  if (!picker) return;
  const wasHidden = !picker.classList.contains('visible');
  picker.classList.toggle('visible');

  if (wasHidden) {
    const grid = document.getElementById('calMpGrid');
    if (!grid) return;
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    grid.innerHTML = months.map((m, i) => `<span class="cal-mp-item" data-m="${i + 1}">${m}</span>`).join('');
  }
}

export function jumpToMonth(month: string): void {
  const date = AppState.state.calendarViewDate;
  date.setMonth(parseInt(month) - 1);
  renderCalendar();
  updateCalendarSummary();
  const picker = document.getElementById('calMonthPicker');
  if (picker) picker.classList.remove('visible');
}
