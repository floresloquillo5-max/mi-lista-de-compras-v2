import { AppState } from '../state';
import { CASHEA_LEVELS } from '../config/constants';
import { parseFloatFromLocalString, formatUSD, formatBS } from '../utils/format';
import { $, showToast, truncate } from '../utils/dom';

export function toggleManualInput(): void {
  const toggle = document.getElementById('manualToggle') as HTMLInputElement | null;
  const manualInputs = document.getElementById('manualInputs');
  const listInfo = document.getElementById('listInfo');
  if (!toggle || !manualInputs || !listInfo) return;
  manualInputs.classList.toggle('visible', toggle.checked);
  listInfo.textContent = toggle.checked
    ? '✏️ Usando monto manual'
    : '📋 Usando total seleccionado de la lista';
}

export function swapConversion(): void {
  const from = document.getElementById('convFrom') as HTMLSelectElement | null;
  if (!from) return;
  from.value = from.value === 'USD' ? 'BS' : 'USD';
  calculateConversion();
}

export function calculateConversion(): void {
  const amountInput = document.getElementById('convAmount') as HTMLInputElement | null;
  const from = document.getElementById('convFrom') as HTMLSelectElement | null;
  const resultValue = document.getElementById('convResultValue');
  const rateUsed = document.getElementById('convRateUsed');
  if (!amountInput || !from || !resultValue || !rateUsed) return;

  const amount = parseFloatFromLocalString(amountInput.value);
  const rate = AppState.state.settings.dollarRate;

  if (amount <= 0 || rate <= 0) {
    resultValue.textContent = 'Ingresa un monto válido';
    rateUsed.textContent = '';
    return;
  }

  let result: number;
  if (from.value === 'USD') {
    result = amount * rate;
    resultValue.textContent = formatBS(result);
  } else {
    result = amount / rate;
    resultValue.textContent = formatUSD(result);
  }
  rateUsed.textContent = `Tasa: Bs. ${rate.toFixed(2)}`;

  const resultDiv = document.getElementById('convResult');
  if (resultDiv) resultDiv.classList.add('visible');
}

export function calculateCoverage(): void {
  const manualToggle = document.getElementById('manualToggle') as HTMLInputElement | null;
  const manualAmount = document.getElementById('manualAmount') as HTMLInputElement | null;
  const levelSelect = document.getElementById('calcCasheaLevel') as HTMLSelectElement | null;
  const covTotalUsd = document.getElementById('covTotalUsd');
  const covTotalBs = document.getElementById('covTotalBs');
  const covCasheaUsd = document.getElementById('covCasheaUsd');
  const covCasheaBs = document.getElementById('covCasheaBs');
  const covUserUsd = document.getElementById('covUserUsd');
  const covUserBs = document.getElementById('covUserBs');

  if (!levelSelect || !covTotalUsd || !covCasheaUsd || !covUserUsd) return;

  const rate = AppState.state.settings.dollarRate;
  let total: number;

  if (manualToggle && manualToggle.checked && manualAmount) {
    total = parseFloatFromLocalString(manualAmount.value);
  } else {
    const products = AppState.getProducts();
    total = products.filter(p => p.checked).reduce((sum, p) => sum + p.price * p.qty, 0);
  }

  if (total <= 0 || rate <= 0) {
    showToast('⚠️ Verifica el total y la tasa de cambio');
    return;
  }

  const level = parseInt(levelSelect.value);
  const financingPercent = CASHEA_LEVELS[level] || 0.50;
  const casheaFinances = total * financingPercent;
  const userPayment = total - casheaFinances;

  covTotalUsd.textContent = formatUSD(total);
  if (covTotalBs) covTotalBs.textContent = formatBS(total * rate);
  covCasheaUsd.textContent = formatUSD(casheaFinances);
  if (covCasheaBs) covCasheaBs.textContent = formatBS(casheaFinances * rate);
  covUserUsd.textContent = formatUSD(userPayment);
  if (covUserBs) covUserBs.textContent = formatBS(userPayment * rate);

  const coverageResult = document.getElementById('coverageResult');
  if (coverageResult) coverageResult.classList.add('visible');
}

export function calculateImaginary(): void {
  const capitalInput = document.getElementById('imagCapital') as HTMLInputElement | null;
  const remainInput = document.getElementById('imagRemain') as HTMLInputElement | null;
  const levelSelect = document.getElementById('imagCasheaLevel') as HTMLSelectElement | null;
  if (!capitalInput || !remainInput || !levelSelect) return;

  const capital = parseFloatFromLocalString(capitalInput.value);
  const remain = parseFloatFromLocalString(remainInput.value);
  const rate = AppState.state.settings.dollarRate;

  if (capital <= 0 || remain <= 0 || rate <= 0) {
    showToast('⚠️ Ingresa valores válidos');
    return;
  }

  if (remain >= capital) {
    showToast('⚠️ El monto a guardar no puede ser mayor o igual al capital');
    return;
  }

  const level = parseInt(levelSelect.value);
  const financingPercent = CASHEA_LEVELS[level] || 0.50;
  const purchaseAmount = (capital - remain) / (1 - financingPercent);

  const casheaFinances = purchaseAmount * financingPercent;
  const userPayment = purchaseAmount - casheaFinances;

  const imagPurchaseUsd = document.getElementById('imagPurchaseUsd');
  const imagPurchaseBs = document.getElementById('imagPurchaseBs');
  const imagCasheaUsd = document.getElementById('imagCasheaUsd');
  const imagCasheaBs = document.getElementById('imagCasheaBs');
  const imagUserUsd = document.getElementById('imagUserUsd');
  const imagUserBs = document.getElementById('imagUserBs');
  const imagRemainUsd = document.getElementById('imagRemainUsd');
  const imagRemainBs = document.getElementById('imagRemainBs');

  if (imagPurchaseUsd) imagPurchaseUsd.textContent = formatUSD(purchaseAmount);
  if (imagPurchaseBs) imagPurchaseBs.textContent = formatBS(purchaseAmount * rate);
  if (imagCasheaUsd) imagCasheaUsd.textContent = formatUSD(casheaFinances);
  if (imagCasheaBs) imagCasheaBs.textContent = formatBS(casheaFinances * rate);
  if (imagUserUsd) imagUserUsd.textContent = formatUSD(userPayment);
  if (imagUserBs) imagUserBs.textContent = formatBS(userPayment * rate);
  if (imagRemainUsd) imagRemainUsd.textContent = formatUSD(remain);
  if (imagRemainBs) imagRemainBs.textContent = formatBS(remain * rate);

  const imaginaryResult = document.getElementById('imaginaryResult');
  if (imaginaryResult) imaginaryResult.classList.add('visible');
}

export function calculateByWeight(): void {
  const nameInput = document.getElementById('weightProdName') as HTMLInputElement | null;
  const priceInput = document.getElementById('weightPricePerKg') as HTMLInputElement | null;
  const weightInput = document.getElementById('weightKg') as HTMLInputElement | null;
  const totalUsd = document.getElementById('weightTotalUsd');
  const totalBs = document.getElementById('weightTotalBs');
  const unitPrice = document.getElementById('weightUnitPrice');
  const unitPriceBs = document.getElementById('weightUnitPriceBs');
  const prodDisplay = document.getElementById('weightProdDisplay');
  const weightDisplay = document.getElementById('weightWeightDisplay');

  if (!nameInput || !priceInput || !weightInput || !totalUsd) return;

  const pricePerKg = parseFloatFromLocalString(priceInput.value);
  const weight = parseFloatFromLocalString(weightInput.value);
  const rate = AppState.state.settings.dollarRate;

  if (pricePerKg > 0 && weight > 0) {
    const total = pricePerKg * weight;
    totalUsd.textContent = formatUSD(total);
    if (totalBs) totalBs.textContent = formatBS(total * rate);
    if (unitPrice) unitPrice.textContent = formatUSD(pricePerKg) + '/kg';
    if (unitPriceBs) unitPriceBs.textContent = formatBS(pricePerKg * rate) + '/kg';
    if (prodDisplay) prodDisplay.textContent = truncate(nameInput.value.trim() || '—', 50);
    if (weightDisplay) weightDisplay.textContent = (weight * 1000).toFixed(0) + ' gr';
  } else {
    totalUsd.textContent = '$0.00';
    if (totalBs) totalBs.textContent = 'Bs. 0,00';
  }

  const weightResult = document.getElementById('weightResult');
  if (weightResult) weightResult.classList.add('visible');
}

export function addWeightProductToList(): void {
  const nameInput = document.getElementById('weightProdName') as HTMLInputElement | null;
  const priceInput = document.getElementById('weightPricePerKg') as HTMLInputElement | null;
  const weightInput = document.getElementById('weightKg') as HTMLInputElement | null;
  if (!nameInput || !priceInput || !weightInput) return;

  const name = truncate(nameInput.value.trim(), 50);
  const pricePerKg = parseFloatFromLocalString(priceInput.value);
  const weight = parseFloatFromLocalString(weightInput.value);

  if (!name || pricePerKg <= 0 || weight <= 0) {
    showToast('⚠️ Completa todos los campos');
    return;
  }

  const prodNameInput = document.getElementById('prodName') as HTMLInputElement | null;
  const prodQtyInput = document.getElementById('prodQty') as HTMLInputElement | null;
  const prodUnitInput = document.getElementById('prodUnit') as HTMLInputElement | null;
  const prodPriceInput = document.getElementById('prodPrice') as HTMLInputElement | null;

  if (prodNameInput) prodNameInput.value = name;
  if (prodQtyInput) prodQtyInput.value = String(weight);
  if (prodUnitInput) prodUnitInput.value = 'kg';
  if (prodPriceInput) prodPriceInput.value = (pricePerKg * weight).toFixed(2);

  nameInput.value = '';
  priceInput.value = '';
  weightInput.value = '';

  window.dispatchEvent(new CustomEvent('product:addFromWeight'));
}
