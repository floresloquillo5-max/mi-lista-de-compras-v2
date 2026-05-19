import { AppState } from '../state';
import { saveFinanceData, saveLists } from '../utils/storage';
import { escapeHtml, formatUSD, formatBS, formatNumber, formatDateShort, getCategoryIcon, parseFloatFromLocalString } from '../utils/format';
import { $, $empty, createElement, showToast, downloadFile, truncate, showConfirmModal } from '../utils/dom';
import { SAVINGS_TIPS } from '../config/constants';
import type { Transaction, SavingsContribution, Debt } from '../types';
import { renderProducts } from './products';

let txIdCounter = Date.now();
function nextTxId(): number { return ++txIdCounter; }

export function updateTotals(): void {
  const products = AppState.getProducts();
  const rate = AppState.state.settings.dollarRate;
  const levelSelect = document.getElementById('casheaLevel') as HTMLSelectElement | null;
  const totalUsd = document.getElementById('totalUsd');
  const totalBs = document.getElementById('totalBs');
  const checkedUsd = document.getElementById('checkedUsd');
  const checkedBs = document.getElementById('checkedBs');
  const casheaUsd = document.getElementById('casheaUsd');
  const casheaBs = document.getElementById('casheaBs');
  const casheaPercent = document.getElementById('casheaPercent');
  const userPayUsd = document.getElementById('userPayUsd');
  const userPayBs = document.getElementById('userPayBs');
  const totalsSection = document.getElementById('totalsSection');

  if (products.length === 0) {
    if (totalsSection) totalsSection.style.display = 'none';
    return;
  }
  if (totalsSection) totalsSection.style.display = 'block';

  const total = products.reduce((s, p) => s + p.price * p.qty, 0);
  const checkedTotal = products.filter(p => p.checked).reduce((s, p) => s + p.price * p.qty, 0);
  const level = levelSelect ? parseInt(levelSelect.value) : 2;
  const percent = [0, 0.40, 0.50, 0.60][level] || 0.50;
  const casheaAmount = checkedTotal * percent;
  const userAmount = checkedTotal - casheaAmount;

  if (totalUsd) totalUsd.textContent = formatUSD(total);
  if (totalBs) totalBs.textContent = formatBS(total * rate);
  if (checkedUsd) checkedUsd.textContent = formatUSD(checkedTotal);
  if (checkedBs) checkedBs.textContent = formatBS(checkedTotal * rate);
  if (casheaUsd) casheaUsd.textContent = formatUSD(casheaAmount);
  if (casheaBs) casheaBs.textContent = formatBS(casheaAmount * rate);
  if (casheaPercent) casheaPercent.textContent = String(percent * 100);
  if (userPayUsd) userPayUsd.textContent = formatUSD(userAmount);
  if (userPayBs) userPayBs.textContent = formatBS(userAmount * rate);
}

export function renderFinanceSummary(): void {
  const container = document.getElementById('monthlySummary');
  if (!container) return;

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthTxs = AppState.state.transactions.filter(tx => {
    const d = new Date(tx.date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amountUSD, 0);
  const expense = monthTxs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').reduce((s, tx) => s + tx.amountUSD, 0);
  const balance = income - expense;

  $empty(container);
  container.appendChild(createElement('div', { className: 'summary-grid' }, [
    createElement('div', { className: 'summary-item' }, [
      createElement('span', { className: 'summary-label' }, ['💰 Ingresos']),
      createElement('span', { className: 'summary-value income' }, [formatUSD(income)]),
    ]),
    createElement('div', { className: 'summary-item' }, [
      createElement('span', { className: 'summary-label' }, ['💸 Gastos']),
      createElement('span', { className: 'summary-value expense' }, [formatUSD(expense)]),
    ]),
    createElement('div', { className: 'summary-item' }, [
      createElement('span', { className: 'summary-label' }, ['📊 Balance']),
      createElement('span', { className: 'summary-value balance' }, [formatUSD(balance)]),
    ]),
  ]));
}

export function renderSavingsGoal(): void {
  const goal = AppState.state.savingsGoalData;
  const form = document.getElementById('savingsGoalForm');
  const display = document.getElementById('savingsGoalDisplay');
  if (!form || !display) return;

  if (!goal || goal.amountUSD <= 0) {
    form.style.display = 'block';
    display.style.display = 'none';
    return;
  }

  form.style.display = 'none';
  display.style.display = 'block';

  const descDisplay = document.getElementById('savingsGoalDescDisplay');
  if (descDisplay) descDisplay.textContent = goal.description || 'Meta de ahorro';

  const amountDisplay = document.getElementById('savingsGoalAmountDisplay');
  if (amountDisplay) {
    const totalSaved = (goal.contributions || []).reduce((s, c) => s + (c.currency === 'USD' ? c.amount : c.amount / (AppState.state.settings.dollarRate || 1)), 0);
    amountDisplay.textContent = `${formatUSD(totalSaved)} de ${formatUSD(goal.amountUSD)}`;
  }

  const progress = document.getElementById('savingsProgress');
  if (progress) {
    const totalSaved = (goal.contributions || []).reduce((s, c) => s + (c.currency === 'USD' ? c.amount : c.amount / (AppState.state.settings.dollarRate || 1)), 0);
    const pct = Math.min(100, Math.round((totalSaved / goal.amountUSD) * 100));
    progress.innerHTML = `
      <div class="savings-bar-wrap">
        <div class="savings-bar" style="width:${pct}%"></div>
      </div>
      <div class="savings-pct">${pct}% completado</div>
    `;
  }

  const list = document.getElementById('savingsContributionsList');
  if (list) {
    const contribs = goal.contributions || [];
    if (contribs.length === 0) {
      list.innerHTML = '<div class="savings-empty">Aún no has hecho abonos</div>';
    } else {
      list.innerHTML = contribs.map(c => `
        <div class="savings-contribution">
          <span class="sc-amount">${c.currency === 'USD' ? formatUSD(c.amount) : formatBS(c.amount)}</span>
          <span class="sc-desc">${escapeHtml(c.description || '')}</span>
          <span class="sc-date">${formatDateShort(c.date)}</span>
        </div>
      `).join('');
    }
  }
}

export function setSavingsGoal(): void {
  const input = document.getElementById('savingsGoalInput') as HTMLInputElement | null;
  const desc = document.getElementById('savingsGoalDesc') as HTMLInputElement | null;
  const currency = document.getElementById('savingsGoalCurrency') as HTMLSelectElement | null;
  if (!input || !currency) return;

  const amount = parseFloatFromLocalString(input.value);
  if (amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

  const goalAmountUSD = currency.value === 'USD' ? amount : amount / (AppState.state.settings.dollarRate || 1);
  AppState.state.savingsGoalData = {
    amountUSD: goalAmountUSD,
    description: truncate(desc ? desc.value.trim() : '', 60),
    currency: currency.value as 'USD' | 'BS',
    originalAmount: amount,
    contributions: [],
  };
  saveFinanceData();
  renderSavingsGoal();
  showToast('🎯 Meta de ahorro fijada');
}

export function deleteSavingsGoal(): void {
  showConfirmModal(
    '🗑️ Eliminar Meta',
    '¿Eliminar la meta de ahorro? Todos los abonos registrados se perderán.',
    'Eliminar',
    () => {
      AppState.state.savingsGoalData = null;
      saveFinanceData();
      renderSavingsGoal();
      showToast('🗑️ Meta eliminada');
    }
  );
}

export function addSavingsContribution(): void {
  const amountInput = document.getElementById('savingsContributionAmount') as HTMLInputElement | null;
  const descInput = document.getElementById('savingsContributionDesc') as HTMLInputElement | null;
  if (!amountInput) return;

  const amount = parseFloatFromLocalString(amountInput.value);
  if (amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

  const goal = AppState.state.savingsGoalData;
  if (!goal) return;

  goal.contributions.push({
    id: nextTxId(),
    amount,
    currency: 'USD',
    description: truncate(descInput ? descInput.value.trim() : '', 100),
    date: new Date().toISOString().split('T')[0],
  });
  saveFinanceData();
  renderSavingsGoal();
  amountInput.value = '';
  if (descInput) descInput.value = '';
  showToast('💰 Abono registrado');
}

export function setDefaultTransactionDate(): void {
  const dateInput = document.getElementById('transactionDate') as HTMLInputElement | null;
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

export function addTransaction(): void {
  const dateInput = document.getElementById('transactionDate') as HTMLInputElement | null;
  const typeSelect = document.getElementById('transactionType') as HTMLSelectElement | null;
  const catSelect = document.getElementById('transactionCategory') as HTMLSelectElement | null;
  const amountInput = document.getElementById('transactionAmount') as HTMLInputElement | null;
  const currencySelect = document.getElementById('transactionCurrency') as HTMLSelectElement | null;
  const descInput = document.getElementById('transactionDesc') as HTMLInputElement | null;

  if (!dateInput || !typeSelect || !catSelect || !amountInput || !currencySelect) return;

  const amount = parseFloatFromLocalString(amountInput.value);
  if (amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

  const currency = currencySelect.value as 'USD' | 'BS';
  const rate = AppState.state.settings.dollarRate;

  const tx: Transaction = {
    id: nextTxId(),
    date: dateInput.value,
    type: typeSelect.value as Transaction['type'],
    category: catSelect.value,
    amountUSD: currency === 'USD' ? amount : amount / (rate || 1),
    amountBS: currency === 'BS' ? amount : amount * rate,
    currency,
    description: truncate(descInput ? descInput.value.trim() : '', 100),
  };

  AppState.state.transactions.push(tx);
  saveFinanceData();
  renderTransactionHistory();
  renderFinanceSummary();
  renderCharts();
  renderStatistics();
  renderCalendarFromFinance();
  if (amountInput) amountInput.value = '';
  if (descInput) descInput.value = '';
  showToast('✅ Movimiento registrado');
}

export function useCurrentListTotal(): void {
  const products = AppState.getProducts();
  const total = products.filter(p => p.checked).reduce((s, p) => s + p.price * p.qty, 0);
  if (total <= 0) { showToast('⚠️ La lista no tiene productos seleccionados'); return; }
  const amountInput = document.getElementById('transactionAmount') as HTMLInputElement | null;
  if (amountInput) amountInput.value = total.toFixed(2);
  showToast(`📋 Total de lista: ${formatUSD(total)}`);
}

export function renderTransactionHistory(): void {
  const container = document.getElementById('transactionHistory');
  if (!container) return;

  const txs = AppState.state.transactions;
  if (txs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No hay transacciones registradas.</p></div>';
    return;
  }

  const sorted = [...txs].reverse();
  const rows = sorted.map(tx => `
    <div class="history-row" data-txid="${tx.id}">
      <span class="history-date">${formatDateShort(tx.date)}</span>
      <span class="history-type">${tx.type === 'income' ? '💰 Ingreso' : '💸 Gasto'}</span>
      <span class="history-cat">${getCategoryIcon(tx.category)} ${escapeHtml(tx.category)}</span>
      <span class="history-amount ${tx.type === 'income' ? 'income' : 'expense'}">${formatUSD(tx.amountUSD)}</span>
      <span class="history-desc">${escapeHtml(tx.description || '—')}</span>
      <button class="history-delete" data-txid="${tx.id}" title="Eliminar">🗑️</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="history-header">
      <span>Fecha</span>
      <span>Tipo</span>
      <span>Categoría</span>
      <span>Monto</span>
      <span>Descripción</span>
      <span></span>
    </div>
    ${rows}
    <div style="margin-top:8px;text-align:right;">
      <button class="btn btn-sm btn-danger" id="clearAllTxBtn">🗑️ Borrar todo (${txs.length})</button>
    </div>
  `;
}

export function deleteTransaction(id: number): void {
  AppState.state.transactions = AppState.state.transactions.filter(tx => tx.id !== id);
  saveFinanceData();
  renderTransactionHistory();
  renderFinanceSummary();
  renderCharts();
  renderStatistics();
  renderCalendarFromFinance();
}

export function clearAllTransactions(): void {
  const count = AppState.state.transactions.length;
  if (count === 0) { showToast('📭 No hay transacciones'); return; }
  showConfirmModal(
    '🗑️ Borrar Todo',
    `¿Eliminar las ${count} transacciones? Esta acción no se puede deshacer.`,
    'Borrar Todo',
    () => {
      AppState.state.transactions = [];
      saveFinanceData();
      renderTransactionHistory();
      renderFinanceSummary();
      renderCharts();
      renderStatistics();
      renderCalendarFromFinance();
      showToast('🗑️ Todas las transacciones borradas');
    }
  );
}

export function renderCharts(): void {
  const container = document.getElementById('chartsContainer');
  if (!container) return;

  const txs = AppState.state.transactions;
  if (txs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Registra transacciones para ver gráficos.</p></div>';
    return;
  }

  const catNames: Record<string, string> = {
    comida: '🍔', bebida: '🥤', transporte: '🚗', deudas: '💳',
    servicios: '💡', salario: '💼', freelance: '💻', inversion: '📈',
    ahorro: '🐷', otros: '📦',
  };
  const expenses = txs.filter(tx => tx.type === 'expense' || tx.type === 'egreso');
  const catTotals: Record<string, number> = {};
  expenses.forEach(tx => { catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amountUSD; });
  const catTotal = Object.values(catTotals).reduce((s, v) => s + v, 0) || 1;
  const catColors: Record<string, string> = {
    comida: '#e74c3c', bebida: '#3498db', transporte: '#f39c12', deudas: '#9b59b6',
    servicios: '#1abc9c', salario: '#2ecc71', freelance: '#e67e22', inversion: '#95a5a6',
    ahorro: '#00CEC9', otros: '#636e72',
  };
  const colorList = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#95a5a6', '#00CEC9', '#636e72'];
  const catLegend = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val], i) => {
      const pct = ((val / catTotal) * 100).toFixed(1);
      const color = catColors[cat] || colorList[i % colorList.length];
      const icon = catNames[cat] || '📦';
      return `<span class="chart-legend-item"><span class="legend-dot" style="background:${color}"></span> ${icon} ${cat.charAt(0).toUpperCase() + cat.slice(1)} <em>${pct}%</em></span>`;
    }).join('');

  container.innerHTML = `
    <div class="chart-grid">
      <div class="chart-card">
        <h4>📊 Ingresos vs Gastos (Últimos 6 meses)</h4>
        <div class="chart-bar-legend">
          <span><span class="legend-dot" style="background:#27ae60"></span> Ingresos</span>
          <span><span class="legend-dot" style="background:#e74c3c"></span> Gastos</span>
        </div>
        <canvas id="barChart"></canvas>
      </div>
      <div class="chart-card">
        <h4>🥧 Gastos por Categoría</h4>
        <canvas id="donutChart"></canvas>
        <div class="chart-donut-legend">${catLegend}</div>
        <div class="chart-footnote">💡 Las deudas se registran en <strong>Gestión de Deudas</strong></div>
      </div>
    </div>`;

  if (container.offsetParent === null) return;

  drawIncomeExpenseChart(txs);
  drawCategoryChart(txs);
}

function drawIncomeExpenseChart(txs: Transaction[]): void {
  const canvas = document.getElementById('barChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const parent = canvas.parentElement;
  const containerW = parent ? parent.clientWidth : 300;
  canvas.width = Math.min(containerW - 4, 500);
  canvas.height = 220;
  const c = ctx;

  if (canvas.width <= 0) return;

  const months: string[] = [];
  const incomeData: number[] = [];
  const expenseData: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();
    months.push(d.toLocaleDateString('es-VE', { month: 'short' }).slice(0, 3));

    const monthTxs = txs.filter(tx => {
      const txd = new Date(tx.date + 'T12:00:00');
      return txd.getMonth() === m && txd.getFullYear() === y;
    });
    incomeData.push(monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amountUSD, 0));
    expenseData.push(monthTxs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').reduce((s, tx) => s + tx.amountUSD, 0));
  }

  const maxVal = Math.max(...incomeData, ...expenseData, 1);
  const w = canvas.width;
  const h = canvas.height;
  const padding = { top: 20, right: 10, bottom: 22, left: 10 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const slotW = chartW / months.length;
  const barWidth = Math.max(8, slotW / 2.2);
  const fontSize = Math.max(9, Math.min(12, slotW / 3));

  const targetIncome = incomeData.map(v => (v / maxVal) * chartH);
  const targetExpense = expenseData.map(v => (v / maxVal) * chartH);

  function drawBarValues(ease: number): void {
    c.font = `bold ${Math.max(8, fontSize - 1)}px Inter, sans-serif`;
    c.textAlign = 'center';
    months.forEach((_, i) => {
      const x = padding.left + i * slotW;
      const incomeV = targetIncome[i] * ease;
      const expenseV = targetExpense[i] * ease;
      const centerX = x + slotW / 2;

      if (incomeV >= 6) {
        c.fillStyle = '#27ae60';
        c.fillText(formatUSD(incomeData[i]), centerX - barWidth / 2 - 2, padding.top + chartH - incomeV - 4);
      }
      if (expenseV >= 6) {
        c.fillStyle = '#e74c3c';
        c.fillText(formatUSD(expenseData[i]), centerX + barWidth / 2 + 2, padding.top + chartH - expenseV - 4);
      }
    });
  }

  function drawBars(progress: number): void {
    const ease = 1 - Math.pow(1 - progress, 3);
    c.clearRect(0, 0, w, h);

    months.forEach((_, i) => {
      const x = padding.left + i * slotW;
      const incomeH = targetIncome[i] * ease;
      const expenseH = targetExpense[i] * ease;
      const centerX = x + slotW / 2;

      if (incomeH > 0) {
        c.fillStyle = '#27ae60';
        c.fillRect(centerX - barWidth, padding.top + chartH - incomeH, barWidth, incomeH);
      }
      if (expenseH > 0) {
        c.fillStyle = '#e74c3c';
        c.fillRect(centerX + 1, padding.top + chartH - expenseH, barWidth, expenseH);
      }
    });

    drawBarValues(ease);

    c.fillStyle = '#888';
    c.font = `${fontSize}px Inter, sans-serif`;
    c.textAlign = 'center';
    months.forEach((m, i) => {
      c.fillText(m, padding.left + i * slotW + slotW / 2, h - 3);
    });
  }

  const duration = 500;
  const start = performance.now();
  function frame(now: number): void {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    drawBars(progress);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function drawCategoryChart(txs: Transaction[]): void {
  const canvas = document.getElementById('donutChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const parent = canvas.parentElement;
  const containerW = parent ? parent.clientWidth : 300;
  canvas.width = Math.min(containerW - 4, 500);
  canvas.height = 220;
  const c = ctx;
  const cv = canvas;

  if (canvas.width <= 0) return;

  const expenses = txs.filter(tx => tx.type === 'expense' || tx.type === 'egreso');
  const catTotals: Record<string, number> = {};
  expenses.forEach(tx => {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amountUSD;
  });

  const colors = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#95a5a6', '#00CEC9', '#636e72'];
  const total = Object.values(catTotals).reduce((s, v) => s + v, 0) || 1;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 - 8;
  const r = Math.min(cx, cy) - 6;

  const entries = Object.entries(catTotals);
  const segments: { angle: number; color: string }[] = [];
  entries.forEach(([_, val], i) => {
    segments.push({
      angle: (val / total) * Math.PI * 2,
      color: colors[i % colors.length],
    });
  });

  function drawDonut(progress: number): void {
    const ease = 1 - Math.pow(1 - progress, 3);
    const totalAngle = Math.PI * 2 * ease;
    c.clearRect(0, 0, cv.width, cv.height);

    let drawn = 0;
    let startAngle = -Math.PI / 2;
    for (const seg of segments) {
      if (drawn + seg.angle <= totalAngle) {
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, r, startAngle, startAngle + seg.angle);
        c.closePath();
        c.fillStyle = seg.color;
        c.fill();
        startAngle += seg.angle;
        drawn += seg.angle;
      } else {
        const remaining = totalAngle - drawn;
        if (remaining > 0.01) {
          c.beginPath();
          c.moveTo(cx, cy);
          c.arc(cx, cy, r, startAngle, startAngle + remaining);
          c.closePath();
          c.fillStyle = seg.color;
          c.fill();
        }
        break;
      }
    }
  }

  const duration = 500;
  const start = performance.now();
  function frame(now: number): void {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    drawDonut(progress);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function renderStatistics(): void {
  const container = document.getElementById('statisticsContainer');
  if (!container) return;

  const txs = AppState.state.transactions;
  if (txs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div><p>No hay datos estadísticos aún.</p></div>';
    return;
  }

  const totalIncome = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amountUSD, 0);
  const totalExpense = txs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').reduce((s, tx) => s + tx.amountUSD, 0);
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
  const avgMonthlyIncome = totalIncome > 0 ? totalIncome / Math.max(1, getMonthCount()) : 0;
  const avgMonthlyExpense = totalExpense > 0 ? totalExpense / Math.max(1, getMonthCount()) : 0;

  const catCount: Record<string, number> = {};
  txs.filter(tx => tx.type === 'expense' || tx.type === 'egreso').forEach(tx => {
    catCount[tx.category] = (catCount[tx.category] || 0) + tx.amountUSD;
  });
  const topCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  const topCatIcon = topCategory ? getCategoryIcon(topCategory[0]) : '—';
  const topCatName = topCategory ? escapeHtml(topCategory[0]) : '';

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Ingresos totales</div><div class="stat-value" style="color:var(--success)">${formatUSD(totalIncome)}</div></div>
      <div class="stat-card"><div class="stat-icon">💸</div><div class="stat-label">Gastos totales</div><div class="stat-value" style="color:var(--expense-red)">${formatUSD(totalExpense)}</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Balance global</div><div class="stat-value" style="color:var(--blue)">${formatUSD(balance)}</div></div>
      <div class="stat-card"><div class="stat-icon">🐷</div><div class="stat-label">Tasa de ahorro</div><div class="stat-value">${savingsRate.toFixed(1)}%</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">Prom. ingreso / mes</div><div class="stat-value">${formatUSD(avgMonthlyIncome)}</div></div>
      <div class="stat-card"><div class="stat-icon">📉</div><div class="stat-label">Prom. gasto / mes</div><div class="stat-value" style="color:var(--expense-red)">${formatUSD(avgMonthlyExpense)}</div></div>
      <div class="stat-card"><div class="stat-icon">🏷️</div><div class="stat-label">Categoría más usada</div><div class="stat-value">${topCatIcon} ${topCatName}</div></div>
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">Total transacciones</div><div class="stat-value">${txs.length}</div></div>
    </div>
  `;
}

function getMonthCount(): number {
  if (AppState.state.transactions.length === 0) return 1;
  const dates = AppState.state.transactions.map(tx => new Date(tx.date + 'T12:00:00').getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  return Math.max(1, (maxDate.getFullYear() - minDate.getFullYear()) * 12 + maxDate.getMonth() - minDate.getMonth() + 1);
}

export function exportTransactionsCSV(): void {
  const txs = AppState.state.transactions;
  if (txs.length === 0) { showToast('⚠️ No hay transacciones para exportar'); return; }
  function escCsv(val: string): string {
    const escaped = val.replace(/"/g, '""');
    return escaped.startsWith('=') || escaped.startsWith('+') || escaped.startsWith('-') || escaped.startsWith('@')
      ? "'" + escaped
      : escaped;
  }
  const header = 'Fecha,Tipo,Categoría,Monto USD,Monto BS,Descripción';
  const rows = txs.map(tx =>
    `${tx.date},${tx.type},${tx.category},${tx.amountUSD.toFixed(2)},${tx.amountBS.toFixed(2)},"${escCsv(tx.description || '')}"`
  ).join('\n');
  downloadFile(header + '\n' + rows, `transacciones_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

export function exportTransactionsJSON(): void {
  const txs = AppState.state.transactions;
  if (txs.length === 0) { showToast('⚠️ No hay transacciones para exportar'); return; }
  downloadFile(JSON.stringify(txs, null, 2), `transacciones_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
}

export function importTransactionsCSV(): void {
  const input = document.getElementById('importCsvInput') as HTMLInputElement | null;
  if (input) input.click();
}

export function handleImportCsvFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) { showToast('⚠️ CSV vacío o inválido'); return; }

      const imported: Transaction[] = [];
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const cols = parseCsvLine(lines[i]);
          if (cols.length < 6) { errors++; continue; }

          const date = cols[0].trim();
          const type = cols[1].trim() as Transaction['type'];
          const category = cols[2].trim();
          const amountUSD = parseFloat(cols[3].replace(',', '.'));
          const amountBS = parseFloat(cols[4].replace(',', '.'));
          const description = cols[5].trim();

          if (!date || isNaN(amountUSD) || isNaN(amountBS)) { errors++; continue; }

          imported.push({
            id: nextTxId(),
            date,
            type: type === 'income' || type === 'expense' ? type : 'expense',
            category: category || 'otros',
            amountUSD: amountUSD || 0,
            amountBS: amountBS || 0,
            currency: amountUSD > 0 ? 'USD' : 'BS',
            description: truncate(description || '', 100),
          });
        } catch {
          errors++;
        }
      }

      if (imported.length === 0) { showToast('⚠️ No se pudieron importar registros'); return; }

      AppState.state.transactions = AppState.state.transactions.concat(imported);
      saveFinanceData();
      renderTransactionHistory();
      renderFinanceSummary();
      renderCharts();
      renderStatistics();
      renderCalendarFromFinance();
      showToast(`✅ ${imported.length} transacciones importadas${errors > 0 ? ` (${errors} errores)` : ''}`);
    } catch {
      showToast('❌ Error al leer el archivo CSV');
    }
  };
  reader.readAsText(file);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function showRandomTip(): void {
  const container = document.getElementById('savingsTip');
  if (!container) return;
  const tip = SAVINGS_TIPS[Math.floor(Math.random() * SAVINGS_TIPS.length)];
  container.textContent = tip;
}

/* Calendar integration */
function renderCalendarFromFinance(): void {
  window.dispatchEvent(new CustomEvent('finance:updated'));
}

/* Debt Management */
export function toggleDebtForm(): void {
  const form = document.getElementById('debtForm');
  const icon = document.getElementById('debtFormToggleIcon');
  if (!form || !icon) return;
  const isVisible = form.style.display === 'block';
  form.style.display = isVisible ? 'none' : 'block';
  icon.textContent = isVisible ? '▼' : '▲';
}

export function addDebt(): void {
  const desc = document.getElementById('debtDesc') as HTMLInputElement | null;
  const amount = document.getElementById('debtAmount') as HTMLInputElement | null;
  const currency = document.getElementById('debtCurrency') as HTMLSelectElement | null;
  const category = document.getElementById('debtCategory') as HTMLSelectElement | null;
  const installments = document.getElementById('debtInstallments') as HTMLInputElement | null;
  const date = document.getElementById('debtDate') as HTMLInputElement | null;

  if (!desc || !amount || !currency || !category || !installments || !date) return;

  const descVal = truncate(desc.value.trim(), 100);
  const amountVal = parseFloatFromLocalString(amount.value);
  if (!descVal || amountVal <= 0) { showToast('⚠️ Completa todos los campos'); return; }

  AppState.state.debts.push({
    id: nextTxId(),
    description: descVal,
    totalAmount: amountVal,
    currency: currency.value as 'USD' | 'BS',
    category: category.value,
    installments: parseInt(installments.value) || 1,
    paidAmount: 0,
    date: date.value,
    payments: [],
  });
  saveFinanceData();
  renderDebts();
  desc.value = '';
  amount.value = '';
  toggleDebtForm();
  showToast('💳 Deuda registrada');
}

export function deleteDebt(id: number): void {
  const debt = AppState.state.debts.find(d => d.id === id);
  if (!debt) return;
  showConfirmModal(
    '🗑️ Eliminar Deuda',
    `¿Eliminar la deuda "${escapeHtml(debt.description)}"?`,
    'Eliminar',
    () => {
      AppState.state.debts = AppState.state.debts.filter(d => d.id !== id);
      saveFinanceData();
      renderDebts();
    }
  );
}

export function markDebtPayment(id: number): void {
  const debt = AppState.state.debts.find(d => d.id === id);
  if (!debt) return;

  const installmentAmount = debt.totalAmount / debt.installments;
  debt.paidAmount += installmentAmount;
  debt.payments.push({ amount: installmentAmount, date: new Date().toISOString().split('T')[0] });
  saveFinanceData();
  renderDebts();

  AppState.state.transactions.push({
    id: nextTxId(),
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: debt.category,
    amountUSD: debt.currency === 'USD' ? installmentAmount : installmentAmount / (AppState.state.settings.dollarRate || 1),
    amountBS: debt.currency === 'BS' ? installmentAmount : installmentAmount * AppState.state.settings.dollarRate,
    currency: debt.currency,
    description: `Pago cuota: ${debt.description}`,
  });
  saveFinanceData();
  renderTransactionHistory();
  renderFinanceSummary();
  renderCharts();
  renderStatistics();
  showToast('✅ Pago registrado');
}

export function renderDebts(): void {
  const list = document.getElementById('debtsList');
  const summary = document.getElementById('debtSummary');
  const empty = document.getElementById('debtsEmpty');
  if (!list || !summary || !empty) return;

  const debts = AppState.state.debts;
  if (debts.length === 0) {
    list.innerHTML = '';
    summary.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  summary.style.display = 'block';

  const totalDebt = debts.reduce((s, d) => s + d.totalAmount, 0);
  const totalPaid = debts.reduce((s, d) => s + d.paidAmount, 0);
  summary.innerHTML = `
    <div class="debt-summary-grid">
      <span>Total deudas: <strong>$${totalDebt.toFixed(2)}</strong></span>
      <span>Pagado: <strong>$${totalPaid.toFixed(2)}</strong></span>
      <span>Restante: <strong>$${(totalDebt - totalPaid).toFixed(2)}</strong></span>
    </div>
  `;

  list.innerHTML = debts.map(d => {
    const pct = d.totalAmount > 0 ? ((d.paidAmount / d.totalAmount) * 100).toFixed(0) : '0';
    return `
      <div class="debt-item">
        <div class="debt-header">
          <span class="debt-desc">${escapeHtml(d.description)}</span>
          <span class="debt-amount">${d.currency === 'USD' ? '$' : 'Bs.'}${d.totalAmount.toFixed(2)}</span>
        </div>
        <div class="debt-progress"><div class="debt-progress-bar" style="width:${pct}%"></div></div>
        <div class="debt-footer">
          <span>${d.paidAmount.toFixed(2)} / ${d.totalAmount.toFixed(2)} (${pct}%)</span>
          <span>Cuota: ${d.installments > 0 ? '$' + (d.totalAmount / d.installments).toFixed(2) : '—'}</span>
        </div>
        <div class="debt-actions">
          <button class="btn btn-sm btn-primary" data-action="markDebtPayment" data-id="${d.id}">💰 Pagar cuota</button>
          <button class="btn btn-sm btn-danger" data-action="deleteDebt" data-id="${d.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

export function showTransactionDetail(tx: Transaction): void {
  const title = document.getElementById('txDetailTitle');
  const body = document.getElementById('txDetailBody');
  const modal = document.getElementById('txDetailModal');
  if (!title || !body || !modal) return;

  title.textContent = `📋 ${tx.type === 'income' ? '💰 Ingreso' : '💸 Gasto'}`;
  body.innerHTML = `
    <div class="tx-detail-row"><span class="tx-detail-label">Fecha:</span><span>${escapeHtml(tx.date)}</span></div>
    <div class="tx-detail-row"><span class="tx-detail-label">Categoría:</span><span>${getCategoryIcon(tx.category)} ${escapeHtml(tx.category)}</span></div>
    <div class="tx-detail-row"><span class="tx-detail-label">Monto USD:</span><span>${formatUSD(tx.amountUSD)}</span></div>
    <div class="tx-detail-row"><span class="tx-detail-label">Monto Bs.:</span><span>${formatBS(tx.amountBS)}</span></div>
    <div class="tx-detail-row"><span class="tx-detail-label">Descripción:</span><span>${escapeHtml(tx.description || '—')}</span></div>
  `;
  modal.classList.add('visible');
}

export function closeTxDetailModal(): void {
  const modal = document.getElementById('txDetailModal');
  if (modal) modal.classList.remove('visible');
}
