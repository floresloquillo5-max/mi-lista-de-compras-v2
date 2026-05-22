// ===== ESTADO GLOBAL =====
let dollarRate = 0;
let currentPage = 0;
let currentListId = 'default';
let marketLists = {};

const CASHEA_LEVELS = {
    1: 0.40,
    2: 0.50,
    3: 0.60
};

// ===== UTILIDADES (definidas al inicio) =====
// Convierte un string con formato local (puntos como miles, coma decimal) a número
function parseFloatFromLocalString(str) {
    if (typeof str !== 'string') str = String(str);
    // Reemplazar coma decimal por punto
    let normalized = str.trim().replace(/,/g, '.');
    // Detectar si hay más de un punto (separadores de miles)
    const parts = normalized.split('.');
    if (parts.length > 2) {
        // El último es la parte decimal, los anteriores son miles
        const integerPart = parts.slice(0, -1).join('');
        const decimalPart = parts[parts.length - 1];
        normalized = integerPart + '.' + decimalPart;
    } else if (parts.length === 2 && parts[1].length > 2 && normalized.indexOf('.') !== -1) {
        // Si después del punto hay más de 2 dígitos, probablemente no es decimal sino miles (ej: 1.234)
        normalized = parts.join('');
    }
    // Eliminar cualquier carácter que no sea dígito o punto
    normalized = normalized.replace(/[^0-9.]/g, '');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
}

function formatNumber(num, decimals = 2) {
    return num.toFixed(decimals).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatUSD(amount) {
    return '$' + formatNumber(amount);
}

function formatBS(amount) {
    return 'Bs. ' + formatNumber(amount, 2).replace(/,/g, '.');
}

function usdToBs(usd) {
    return usd * dollarRate;
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== INICIALIZACIÓN UNIFICADA =====
document.addEventListener('DOMContentLoaded', () => {
    // Funciones originales
    loadLists();
    fetchRate();
    loadTheme();
    setupSwipe();
    adjustLayoutForScreen();
    window.addEventListener('resize', adjustLayoutForScreen);
    
    // Nuevas funciones de finanzas y menú
    loadFinanceData();
    setupMenu();
    setupFaq();
    setDefaultTransactionDate(); // establecer fecha actual en el campo de fecha
    
    // La vista principal está activa por defecto
    document.body.classList.add('main-view-active');
    
    // Control de visibilidad del botón flotante
    updateFabVisibility();
});

// ===== CONTROL DE VISIBILIDAD DEL BOTÓN FLOTANTE (FAB) =====
function updateFabVisibility() {
    const fab = document.getElementById('fabCalc');
    if (!fab) return;
    const activeView = document.querySelector('.view.active')?.id;
    // Mostrar solo en vista principal, página 0 de la calculadora, y solo en móvil (CSS oculta en desktop)
    if (activeView === 'main-view' && currentPage === 0) {
        fab.classList.add('fab-visible');
    } else {
        fab.classList.remove('fab-visible');
    }
}

// ===== NAVEGACIÓN MÓVIL (original) =====
function adjustLayoutForScreen() {
    const wrapper = document.getElementById('pagesWrapper');
    if (!wrapper) return;
    if (window.innerWidth >= 768) {
        wrapper.style.transform = 'none';
        wrapper.style.width = '100%';
    } else {
        wrapper.style.width = '200%';
        wrapper.style.transform = `translateX(-${currentPage * 50}%)`;
    }
}

function openCalculator() {
    if (window.innerWidth >= 768) return;
    
    // Primero asegurarse de que main-view esté activa
    const activeView = document.querySelector('.view.active');
    if (!activeView || activeView.id !== 'main-view') {
        // Activar main-view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const mainView = document.getElementById('main-view');
        if (mainView) mainView.classList.add('active');
        // Actualizar botones del menú
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        const mainBtn = document.querySelector('.menu-btn[data-view="main"]');
        if (mainBtn) mainBtn.classList.add('active');
        document.body.classList.add('main-view-active');
    }
    
    currentPage = 1;
    const wrapper = document.getElementById('pagesWrapper');
    if (wrapper) wrapper.style.transform = 'translateX(-50%)';
    const hintRight = document.getElementById('swipeHintRight');
    const hintLeft = document.getElementById('swipeHintLeft');
    if (hintRight) hintRight.classList.add('hidden');
    if (hintLeft) hintLeft.classList.add('visible');
    updateFabVisibility();
}


function closeCalculator() {
    if (window.innerWidth >= 768) return;
    
    // Primero asegurarse de que main-view esté activa
    const activeView = document.querySelector('.view.active');
    if (!activeView || activeView.id !== 'main-view') {
        // Activar main-view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const mainView = document.getElementById('main-view');
        if (mainView) mainView.classList.add('active');
        // Actualizar botones del menú
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        const mainBtn = document.querySelector('.menu-btn[data-view="main"]');
        if (mainBtn) mainBtn.classList.add('active');
    }
    
    currentPage = 0;
    const wrapper = document.getElementById('pagesWrapper');
    if (wrapper) wrapper.style.transform = 'translateX(0)';
    const hintRight = document.getElementById('swipeHintRight');
    const hintLeft = document.getElementById('swipeHintLeft');
    if (hintRight) hintRight.classList.remove('hidden');
    if (hintLeft) hintLeft.classList.remove('visible');
    updateFabVisibility();
}


function toggleListManagement() {
    const toggle = document.getElementById('listManagementToggle');
    const section = document.getElementById('listManagementSection');
    if (!toggle || !section) return;
    toggle.classList.toggle('active');
    section.classList.toggle('visible');
    if (section.classList.contains('visible')) updateListSelector();
}

// ===== GESTIÓN DE LISTAS (original, sin cambios) =====
function loadLists() {
    try {
        const saved = localStorage.getItem('market_lists_v2');
        if (saved) marketLists = JSON.parse(saved);
    } catch(e) {
        marketLists = {};
    }

    if (!marketLists['default']) {
        let migratedProducts = [];
        try {
            const old = localStorage.getItem('market_products');
            if (old) migratedProducts = JSON.parse(old);
        } catch(e) {}
        marketLists['default'] = {
            id: 'default',
            name: 'Mi Lista',
            products: migratedProducts,
            createdAt: new Date().toISOString()
        };
        saveLists();
    }

    const savedListId = localStorage.getItem('currentListId');
    if (savedListId && marketLists[savedListId]) {
        currentListId = savedListId;
    } else {
        currentListId = 'default';
        localStorage.setItem('currentListId', currentListId);
    }

    renderListTitle();
    renderProducts();
    updateTotals();
}

function saveLists() {
    try {
        localStorage.setItem('market_lists_v2', JSON.stringify(marketLists));
    } catch(e) {
        showToast('⚠️ Error al guardar');
    }
}

function persistCurrentListId() {
    localStorage.setItem('currentListId', currentListId);
}

function getCurrentList() {
    if (!marketLists[currentListId]) currentListId = 'default';
    return marketLists[currentListId];
}

function getProducts() {
    return getCurrentList().products || [];
}

function setProducts(arr) {
    getCurrentList().products = arr;
    saveLists();
}

function renderListTitle() {
    const list = getCurrentList();
    const titleEl = document.getElementById('listTitle');
    if (titleEl) {
        titleEl.innerHTML = `📋 ${escapeHtml(list.name)} <button class="btn-icon" onclick="editListName()" title="Renombrar">✏️</button>`;
    }
}

function switchList(id) {
    if (!marketLists[id]) return;
    currentListId = id;
    persistCurrentListId();
    renderListTitle();
    renderProducts();
    updateTotals();
    showToast(`📋 Lista "${marketLists[id].name}" cargada`);
}

function updateListSelector() {
    const select = document.getElementById('listSelect');
    if (!select) return;
    select.innerHTML = Object.values(marketLists).map(list => {
        const count = (list.products || []).length;
        const sel = list.id === currentListId ? 'selected' : '';
        return `<option value="${list.id}" ${sel}>${escapeHtml(list.name)} (${count})</option>`;
    }).join('');
}

function openImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.add('visible');
}
function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('visible');
    const textarea = document.getElementById('importText');
    if (textarea) textarea.value = '';
}
function editListName() {
    const input = document.getElementById('newListName');
    if (input) input.value = getCurrentList().name;
    const modal = document.getElementById('renameModal');
    if (modal) modal.classList.add('visible');
}
function closeRenameModal() {
    const modal = document.getElementById('renameModal');
    if (modal) modal.classList.remove('visible');
}

function saveListName() {
    const nameInput = document.getElementById('newListName');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) { showToast('⚠️ Ingresa un nombre válido'); return; }
    getCurrentList().name = name;
    saveLists();
    renderListTitle();
    closeRenameModal();
    showToast('✅ Nombre actualizado');
}

function createNewList() {
    showPromptModal(
        '✏️ Nueva Lista',
        'Ingresa el nombre para la nueva lista',
        'Nombre de la lista',
        'Ej: Mercado Semanal',
        'Lista ' + (Object.keys(marketLists).length + 1),
        function(name) {
            const id = 'list_' + Date.now();
            marketLists[id] = { id, name: name.trim(), products: [], createdAt: new Date().toISOString() };
            saveLists();
            currentListId = id;
            persistCurrentListId();
            renderListTitle();
            renderProducts();
            updateTotals();
            updateListSelector();
            showToast(`✅ Lista "${name.trim()}" creada`);
        }
    );
}

function copyCurrentList() {
    const src = getCurrentList();
    showPromptModal(
        '📋 Copiar Lista',
        'Ingresa un nombre para la copia',
        'Nombre de la copia',
        'Ej: ' + src.name + ' (respaldo)',
        src.name + ' (copia)',
        function(name) {
            const id = 'list_' + Date.now();
            marketLists[id] = {
                id, name: name.trim(),
                products: JSON.parse(JSON.stringify(src.products || [])).map((p, i) => ({ ...p, id: Date.now() + i + 1 })),
                createdAt: new Date().toISOString()
            };
            saveLists();
            currentListId = id;
            persistCurrentListId();
            renderListTitle();
            renderProducts();
            updateTotals();
            updateListSelector();
            showToast(`📋 Lista copiada como "${name.trim()}"`);
        }
    );
}

function deleteCurrentList() {
    if (currentListId === 'default') { showToast('⚠️ No se puede eliminar la lista principal'); return; }
    showConfirmModal(
        '🗑️ Eliminar Lista',
        `¿Eliminar la lista "${getCurrentList().name}"? Esta acción no se puede deshacer.`,
        'Eliminar',
        function() {
            delete marketLists[currentListId];
            currentListId = 'default';
            persistCurrentListId();
            saveLists();
            renderListTitle();
            renderProducts();
            updateTotals();
            updateListSelector();
            showToast('🗑️ Lista eliminada');
        }
    );
}

function exportCurrentList() {
    const list = getCurrentList();
    const data = { name: list.name, products: list.products || [], exportedAt: new Date().toISOString(), version: '2.0' };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(encoded)
            .then(() => showToast('✅ Código copiado al portapapeles'))
            .catch(() => showExportFallback(encoded));
    } else {
        showExportFallback(encoded);
    }
}

function showExportFallback(code) {
    const textarea = document.getElementById('importText');
    if (textarea) textarea.value = code;
    openImportModal();
    showToast('Copia este código para compartir la lista');
}

function importList() {
    const textarea = document.getElementById('importText');
    if (!textarea) return;
    const code = textarea.value.trim();
    if (!code) { showToast('⚠️ Pega el código de la lista'); return; }
    try {
        const data = JSON.parse(decodeURIComponent(escape(atob(code))));
        if (!data.name || !Array.isArray(data.products)) throw new Error('Formato inválido');
        showPromptModal(
            '📥 Importar Lista',
            'Ingresa un nombre para la lista importada',
            'Nombre',
            'Ej: ' + data.name,
            data.name + ' (importada)',
            function(name) {
                const id = 'list_' + Date.now();
                marketLists[id] = {
                    id, name: name.trim(),
                    products: data.products.map((p, i) => ({
                        id: Date.now() + i + 1,
                        name: p.name || 'Producto',
                        qty: parseInt(p.qty) || 1,
                        unit: p.unit || '',
                        price: parseFloat(p.price) || 0,
                        checked: p.checked !== undefined ? p.checked : true
                    })),
                    createdAt: new Date().toISOString()
                };
                saveLists();
                currentListId = id;
                persistCurrentListId();
                renderListTitle();
                renderProducts();
                updateTotals();
                closeImportModal();
                showToast(`✅ Lista "${name.trim()}" importada`);
            }
        );
    } catch(e) {
        showToast('❌ Código inválido o corrupto');
    }
}

// ===== PRODUCTOS (original) =====
function addProduct() {
    const nameInput = document.getElementById('prodName');
    const qtyInput = document.getElementById('prodQty');
    const unitInput = document.getElementById('prodUnit');
    const priceInput = document.getElementById('prodPrice');
    if (!nameInput || !qtyInput || !unitInput || !priceInput) return;

    const name = nameInput.value.trim();
    const qty = parseInt(parseFloatFromLocalString(qtyInput.value)) || 1;
    const unit = unitInput.value.trim();
    const price = parseFloatFromLocalString(priceInput.value);

    if (!name) { showToast('⚠️ Ingresa el nombre del producto'); nameInput.focus(); return; }
    if (isNaN(price) || price <= 0) { showToast('⚠️ Ingresa un precio válido mayor a 0'); priceInput.focus(); return; }

    const prods = getProducts();
    prods.push({ id: Date.now(), name, qty, unit, price, checked: true });
    setProducts(prods);
    renderProducts();
    updateTotals();

    nameInput.value = '';
    qtyInput.value = '1';
    unitInput.value = '';
    priceInput.value = '';
    nameInput.focus();
    showToast(`✅ ${name} agregado`);
}

function renderProducts() {
    const container = document.getElementById('productList');
    if (!container) return;
    const prods = getProducts();

    if (prods.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Tu lista está vacía.<br>Agrega productos para empezar.</p></div>`;
        const totalsSection = document.getElementById('totalsSection');
        if (totalsSection) totalsSection.style.display = 'none';
        return;
    }

    container.innerHTML = prods.map(p => {
        const subtotal = p.qty * p.price;
        const subtotalBs = usdToBs(subtotal);
        const unitBadge = p.unit ? ` <span class="unit-badge">${escapeHtml(p.unit)}</span>` : '';
        return `
            <div class="product-item ${p.checked ? 'checked' : ''}" data-id="${p.id}">
                <input type="checkbox" class="product-checkbox" ${p.checked ? 'checked' : ''} onchange="toggleProduct(${p.id})">
                <div class="product-info">
                    <div class="product-name">${escapeHtml(p.name)}${unitBadge}</div>
                    <div class="product-details">${p.qty} × ${formatUSD(p.price)}</div>
                </div>
                <div class="product-price">
                    <div class="product-price-usd">${formatUSD(subtotal)}</div>
                    ${dollarRate > 0 ? `<div class="product-price-bs">${formatBS(subtotalBs)}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
                    <button class="product-delete" onclick="enableEditProduct(${p.id})" title="Editar" style="font-size:0.85rem;">✏️</button>
                    <button class="product-delete" onclick="deleteProduct(${p.id})" title="Eliminar">✕</button>
                </div>
            </div>`;
    }).join('');
}

function toggleProduct(id) {
    const prods = getProducts();
    const p = prods.find(x => x.id === id);
    if (p) { p.checked = !p.checked; setProducts(prods); renderProducts(); updateTotals(); }
}

function deleteProduct(id) {
    const prods = getProducts();
    const p = prods.find(x => x.id === id);
    setProducts(prods.filter(x => x.id !== id));
    renderProducts();
    updateTotals();
    if (p) showToast(`🗑️ "${p.name}" eliminado`);
}

function clearList() {
    if (getProducts().length === 0) { showToast('La lista ya está vacía'); return; }
    showConfirmModal(
        '🗑️ Borrar productos',
        '¿Borrar todos los productos de esta lista? Esta acción no se puede deshacer.',
        'Borrar todo',
        function() {
            setProducts([]);
            renderProducts();
            updateTotals();
            showToast('🗑️ Lista borrada');
        }
    );
}

// ===== TOTALES (original) =====
function updateTotals() {
    const section = document.getElementById('totalsSection');
    if (!section) return;

    const levelSelect = document.getElementById('casheaLevel');
    const level = levelSelect ? parseInt(levelSelect.value) || 2 : 2;
    const casheaPercent = CASHEA_LEVELS[level];
    const userPercent = 1 - casheaPercent;

    const prods = getProducts();
    if (prods.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const total   = prods.reduce((s, p) => s + p.qty * p.price, 0);
    const checked = prods.filter(p => p.checked).reduce((s, p) => s + p.qty * p.price, 0);

    const casheaUsd = checked * casheaPercent;
    const userUsd   = checked * userPercent;

    const totalUsdEl = document.getElementById('totalUsd');
    const totalBsEl = document.getElementById('totalBs');
    const checkedUsdEl = document.getElementById('checkedUsd');
    const checkedBsEl = document.getElementById('checkedBs');
    const casheaPercentSpan = document.getElementById('casheaPercent');
    const casheaUsdEl = document.getElementById('casheaUsd');
    const casheaBsEl = document.getElementById('casheaBs');
    const userPayUsdEl = document.getElementById('userPayUsd');
    const userPayBsEl = document.getElementById('userPayBs');

    if (totalUsdEl) totalUsdEl.textContent = formatUSD(total);
    if (totalBsEl) totalBsEl.textContent = formatBS(usdToBs(total));
    if (checkedUsdEl) checkedUsdEl.textContent = formatUSD(checked);
    if (checkedBsEl) checkedBsEl.textContent = formatBS(usdToBs(checked));
    if (casheaPercentSpan) casheaPercentSpan.textContent = Math.round(casheaPercent * 100);
    if (casheaUsdEl) casheaUsdEl.textContent = formatUSD(casheaUsd);
    if (casheaBsEl) casheaBsEl.textContent = formatBS(usdToBs(casheaUsd));
    if (userPayUsdEl) userPayUsdEl.textContent = formatUSD(userUsd);
    if (userPayBsEl) userPayBsEl.textContent = formatBS(usdToBs(userUsd));

    const calcLevel = document.getElementById('calcCasheaLevel');
    const imagLevel = document.getElementById('imagCasheaLevel');
    if (calcLevel) calcLevel.value = level;
    if (imagLevel) imagLevel.value = level;
}

// ===== TEMA (original) =====
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    const isLight = saved === 'light';
    if (isLight) document.body.classList.add('light-theme');
    updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = isLight ? '☀️' : '🌙';
}

// ===== TASA DE CAMBIO (original) =====
async function fetchRate() {
    const display = document.getElementById('rateDisplay');
    if (display) display.innerHTML = '<span class="loading-spinner"></span> Cargando...';

    const apis = [
        async () => {
            const r = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
            const d = await r.json();
            return d?.monitors?.usd?.price;
        },
        async () => {
            const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            const d = await r.json();
            return d?.promedio;
        },
        async () => {
            const r = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv');
            const d = await r.json();
            return d?.monitors?.usd?.price;
        }
    ];

    let rate = null;
    for (const api of apis) {
        try { rate = await api(); if (rate && rate > 0) break; } catch(e) {}
    }

    if (rate && rate > 0) {
        dollarRate = rate;
        localStorage.setItem('dollarRate', rate.toString());
        localStorage.setItem('lastUpdate', new Date().toISOString());
        if (display) display.textContent = `Bs. ${formatNumber(rate, 2)}`;
        const lastUpdateSpan = document.getElementById('lastUpdate');
        if (lastUpdateSpan) {
            const now = new Date();
            lastUpdateSpan.textContent = `Última actualización: ${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})}`;
        }
        renderProducts();
        updateTotals();
    } else {
        loadSavedRate();
    }
}

function loadSavedRate() {
    const savedRate  = localStorage.getItem('dollarRate');
    const savedDate  = localStorage.getItem('lastUpdate');
    const display    = document.getElementById('rateDisplay');
    const lastUpdate = document.getElementById('lastUpdate');

    if (savedRate && parseFloat(savedRate) > 0) {
        dollarRate = parseFloat(savedRate);
        if (display) display.textContent = `Bs. ${formatNumber(dollarRate, 2)} (guardada)`;
        if (savedDate && lastUpdate) {
            const d = new Date(savedDate);
            lastUpdate.textContent = `Tasa guardada del: ${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})}`;
        }
        showToast('📡 Usando tasa guardada (modo offline)');
    } else {
        dollarRate = 0;
        if (display) display.textContent = 'Sin tasa';
        if (lastUpdate) lastUpdate.textContent = 'No se pudo obtener la tasa. Conéctate a internet.';
        showToast('⚠️ Sin tasa de cambio. Conéctate a internet para actualizar.');
    }
    renderProducts();
    updateTotals();
}

// ===== SWIPE (original) =====
function setupSwipe() {
    const wrapper = document.getElementById('pagesWrapper');
    if (!wrapper) return;
    let startX = 0;
    wrapper.addEventListener('touchstart', e => {
        if (window.innerWidth >= 768) return;
        startX = e.touches[0].clientX;
    });
    wrapper.addEventListener('touchend', e => {
        if (window.innerWidth >= 768) return;
        const diff = startX - e.changedTouches[0].clientX;
        if (diff > 50 && currentPage === 0) openCalculator();
        else if (diff < -50 && currentPage === 1) closeCalculator();
    });
}

// ===== CALCULADORA (original) =====
function toggleManualInput() {
    const toggleCheck = document.getElementById('manualToggle');
    if (!toggleCheck) return;
    const checked = toggleCheck.checked;
    const listInfo = document.getElementById('listInfo');
    const manualInputs = document.getElementById('manualInputs');
    if (listInfo) listInfo.style.display = checked ? 'none' : 'inline-flex';
    if (manualInputs) manualInputs.classList.toggle('visible', checked);
}

function swapConversion() {
    const fromSelect = document.getElementById('convFrom');
    if (!fromSelect) return;
    fromSelect.value = fromSelect.value === 'USD' ? 'BS' : 'USD';
    const amountInput = document.getElementById('convAmount');
    if (amountInput) amountInput.value = '';
    const resultDiv = document.getElementById('convResult');
    if (resultDiv) resultDiv.classList.remove('visible');
}

function calculateConversion() {
    if (dollarRate <= 0) { showToast('⚠️ Sin tasa de cambio'); return; }
    const amountInput = document.getElementById('convAmount');
    if (!amountInput) return;
    const amount = parseFloatFromLocalString(amountInput.value);
    if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }
    const from = document.getElementById('convFrom').value;
    const resultEl = document.getElementById('convResult');
    const valueEl = document.getElementById('convResultValue');
    const rateEl = document.getElementById('convRateUsed');
    if (!resultEl || !valueEl || !rateEl) return;

    rateEl.textContent = `Bs. ${formatNumber(dollarRate, 2)} por dólar`;

    if (from === 'USD') {
        const bs = amount * dollarRate;
        valueEl.textContent = `Bs. ${formatNumber(bs, 2)}`;
        valueEl.className = 'calc-result-value bs';
    } else {
        const usd = amount / dollarRate;
        valueEl.textContent = formatUSD(usd);
        valueEl.className = 'calc-result-value usd';
    }
    resultEl.classList.add('visible');
}

function calculateCoverage() {
    const manualToggle = document.getElementById('manualToggle');
    const manual = manualToggle ? manualToggle.checked : false;
    let total;
    if (manual) {
        const manualAmount = document.getElementById('manualAmount');
        total = manualAmount ? parseFloatFromLocalString(manualAmount.value) : 0;
        if (total <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }
    } else {
        const prods = getProducts();
        total = prods.filter(p => p.checked).reduce((s, p) => s + p.qty * p.price, 0);
        if (total <= 0) { showToast('⚠️ Selecciona productos o ingresa monto manual'); return; }
    }

    const levelSelect = document.getElementById('calcCasheaLevel');
    const level = levelSelect ? parseInt(levelSelect.value) || 2 : 2;
    const casheaPercent = CASHEA_LEVELS[level];
    const cashea = total * casheaPercent;
    const user = total * (1 - casheaPercent);

    const covTotalUsd = document.getElementById('covTotalUsd');
    const covTotalBs = document.getElementById('covTotalBs');
    const covCasheaUsd = document.getElementById('covCasheaUsd');
    const covCasheaBs = document.getElementById('covCasheaBs');
    const covUserUsd = document.getElementById('covUserUsd');
    const covUserBs = document.getElementById('covUserBs');
    const coverageResult = document.getElementById('coverageResult');

    if (covTotalUsd) covTotalUsd.textContent = formatUSD(total);
    if (covTotalBs) covTotalBs.textContent = formatBS(usdToBs(total));
    if (covCasheaUsd) covCasheaUsd.textContent = formatUSD(cashea);
    if (covCasheaBs) covCasheaBs.textContent = formatBS(usdToBs(cashea));
    if (covUserUsd) covUserUsd.textContent = formatUSD(user);
    if (covUserBs) covUserBs.textContent = formatBS(usdToBs(user));
    if (coverageResult) coverageResult.classList.add('visible');
}

function calculateImaginary() {
    const capitalInput = document.getElementById('imagCapital');
    const remainInput = document.getElementById('imagRemain');
    if (!capitalInput || !remainInput) return;
    const capital = parseFloatFromLocalString(capitalInput.value);
    const remain = parseFloatFromLocalString(remainInput.value);
    if (capital <= 0 || remain < 0) { showToast('⚠️ Ingresa valores válidos'); return; }
    if (remain >= capital) { showToast('⚠️ El monto a quedar debe ser menor al capital'); return; }

    const levelSelect = document.getElementById('imagCasheaLevel');
    const level = levelSelect ? parseInt(levelSelect.value) || 2 : 2;
    const casheaPercent = CASHEA_LEVELS[level];
    const userPercent = 1 - casheaPercent;

    const purchase = (capital - remain) / userPercent;
    if (purchase <= 0) { showToast('⚠️ El monto a quedar es demasiado grande'); return; }

    const cashea = purchase * casheaPercent;
    const userPay = purchase * userPercent;
    const finalRemain = capital - userPay;

    const imagPurchaseUsd = document.getElementById('imagPurchaseUsd');
    const imagPurchaseBs = document.getElementById('imagPurchaseBs');
    const imagCasheaUsd = document.getElementById('imagCasheaUsd');
    const imagCasheaBs = document.getElementById('imagCasheaBs');
    const imagUserUsd = document.getElementById('imagUserUsd');
    const imagUserBs = document.getElementById('imagUserBs');
    const imagRemainUsd = document.getElementById('imagRemainUsd');
    const imagRemainBs = document.getElementById('imagRemainBs');
    const imaginaryResult = document.getElementById('imaginaryResult');

    if (imagPurchaseUsd) imagPurchaseUsd.textContent = formatUSD(purchase);
    if (imagPurchaseBs) imagPurchaseBs.textContent = formatBS(usdToBs(purchase));
    if (imagCasheaUsd) imagCasheaUsd.textContent = formatUSD(cashea);
    if (imagCasheaBs) imagCasheaBs.textContent = formatBS(usdToBs(cashea));
    if (imagUserUsd) imagUserUsd.textContent = formatUSD(userPay);
    if (imagUserBs) imagUserBs.textContent = formatBS(usdToBs(userPay));
    if (imagRemainUsd) imagRemainUsd.textContent = formatUSD(finalRemain);
    if (imagRemainBs) imagRemainBs.textContent = formatBS(usdToBs(finalRemain));
    if (imaginaryResult) imaginaryResult.classList.add('visible');
}

// ==================== NUEVAS FUNCIONES (FINANZAS, MENÚ, FAQ) ====================
let transactions = [];
let savingsGoalData = null;

function loadFinanceData() {
    try { const saved = localStorage.getItem('finance_transactions'); if (saved) transactions = JSON.parse(saved); } catch(e) {}
    try {
        const raw = localStorage.getItem('savings_goal');
        if (raw) {
            const parsed = JSON.parse(raw);
            // migrar desde formato antiguo (número)
            if (typeof parsed === 'number' || !parsed.contributions) {
                savingsGoalData = { amountUSD: parsed, description: '', currency: 'USD', originalAmount: parsed, contributions: [] };
            } else {
                savingsGoalData = parsed;
            }
        }
    } catch(e) {
        // formato antiguo: era un número guardado como string
        try {
            const old = parseFloat(localStorage.getItem('savings_goal'));
            if (old > 0) savingsGoalData = { amountUSD: old, description: '', currency: 'USD', originalAmount: old, contributions: [] };
        } catch(e2) {}
    }
    renderFinanceSummary();
    renderSavingsGoal();
    showRandomTip();
}
function saveFinanceData() {
    localStorage.setItem('finance_transactions', JSON.stringify(transactions));
    localStorage.setItem('savings_goal', JSON.stringify(savingsGoalData));
}

function renderFinanceSummary() {
    const container = document.getElementById('monthlySummary');
    if (!container) return;
    const now = new Date(), currentYear = now.getFullYear(), currentMonth = now.getMonth();
    let totalIncome = 0, totalExpense = 0;
    transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            if (tx.type === 'income') totalIncome += tx.amountUSD;
            else totalExpense += tx.amountUSD;
        }
    });
    const balance = totalIncome - totalExpense;
    container.innerHTML = `<div class="summary-row"><span>💰 Ingresos:</span><span>${formatUSD(totalIncome)} / ${formatBS(usdToBs(totalIncome))}</span></div>
                           <div class="summary-row"><span>💸 Gastos:</span><span>${formatUSD(totalExpense)} / ${formatBS(usdToBs(totalExpense))}</span></div>
                           <div class="summary-row total"><span>⚖️ Balance:</span><span class="${balance>=0?'positive':'negative'}">${formatUSD(balance)} / ${formatBS(usdToBs(balance))}</span></div>`;
    renderSavingsGoal();
    renderTransactionHistory();
    renderCharts();
    renderStatistics();
}
function renderSavingsGoal() {
    const progressEl = document.getElementById('savingsProgress');
    const formEl = document.getElementById('savingsGoalForm');
    const displayEl = document.getElementById('savingsGoalDisplay');
    if (!progressEl || !formEl || !displayEl) return;

    if (!savingsGoalData || savingsGoalData.amountUSD <= 0) {
        formEl.style.display = 'block';
        displayEl.style.display = 'none';
        return;
    }

    formEl.style.display = 'none';
    displayEl.style.display = 'block';

    // descripción
    document.getElementById('savingsGoalDescDisplay').textContent = savingsGoalData.description || 'Sin descripción';

    // montos
    const totalDisplay = savingsGoalData.currency === 'BS'
        ? `Bs. ${formatNumber(savingsGoalData.originalAmount)} (≈ ${formatUSD(savingsGoalData.amountUSD)})`
        : `${formatUSD(savingsGoalData.amountUSD)}`;
    document.getElementById('savingsGoalAmountDisplay').innerHTML = `
        <span class="savings-goal-target">Meta: <strong>${totalDisplay}</strong></span>
    `;

    // total contribuido
    const totalContrib = savingsGoalData.contributions.reduce((s, c) => s + c.amountUSD, 0);
    const progressPercent = Math.min((totalContrib / savingsGoalData.amountUSD) * 100, 100);

    progressEl.innerHTML = `
        <div class="savings-progress-info">
            <span class="savings-progress-accum">${formatUSD(totalContrib)}</span>
            <span class="savings-progress-sep">de</span>
            <span class="savings-progress-target">${formatUSD(savingsGoalData.amountUSD)}</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progressPercent}%;"></div>
        </div>
        <div class="savings-message">${progressPercent >= 100 ? '🎉 ¡Meta alcanzada! 🎉' : `Te falta ${formatUSD(savingsGoalData.amountUSD - totalContrib)} para alcanzar tu meta`}</div>
    `;

    // contribuciones
    const listEl = document.getElementById('savingsContributionsList');
    if (!listEl) return;
    if (savingsGoalData.contributions.length === 0) {
        listEl.innerHTML = '<div class="savings-empty">Aún no has registrado abonos. ¡Empieza hoy!</div>';
    } else {
        listEl.innerHTML = savingsGoalData.contributions.map(c => `
            <div class="savings-contribution-item">
                <div class="sc-item-left">
                    <span class="sc-amount">${formatUSD(c.amountUSD)}</span>
                    <span class="sc-desc">${c.description || 'Abono'}</span>
                </div>
                <span class="sc-date">${c.date}</span>
            </div>
        `).join('');
    }
}

function addTransaction() {
    // Validar tasa si es necesario
    const currency = document.getElementById('transactionCurrency').value;
    if (dollarRate <= 0 && currency === 'BS') { showToast('⚠️ No hay tasa de cambio para convertir Bs a USD'); return; }
    
    const date = document.getElementById('transactionDate').value;
    if (!date) { showToast('⚠️ Selecciona una fecha'); return; }
    
    const type = document.getElementById('transactionType').value;
    const category = document.getElementById('transactionCategory').value;
    let amountUSD = parseFloatFromLocalString(document.getElementById('transactionAmount').value);
    if (isNaN(amountUSD) || amountUSD <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }
    
    if (currency === 'BS') {
        amountUSD = amountUSD / dollarRate;
    }
    
    const desc = document.getElementById('transactionDesc').value.trim() || (type === 'income' ? 'Ingreso' : 'Gasto');
    
    const newTransaction = {
        id: Date.now(),
        date,
        type,
        category,
        amountUSD,
        description: desc,
        createdAt: new Date().toISOString()
    };
    
    transactions.push(newTransaction);
    saveFinanceData();
    renderFinanceSummary();
    
    // Limpiar formulario
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionDesc').value = '';
    showToast(`✅ ${type === 'income' ? 'Ingreso' : 'Gasto'} registrado`);
}

function useCurrentListTotal() {
    const prods = getProducts();
    const totalSelected = prods.filter(p => p.checked).reduce((s, p) => s + p.qty * p.price, 0);
    if (totalSelected <= 0) { showToast('⚠️ No hay productos seleccionados en la lista'); return; }
    
    document.getElementById('transactionType').value = 'expense';
    document.getElementById('transactionCategory').value = 'comida';
    document.getElementById('transactionAmount').value = totalSelected.toFixed(2);
    document.getElementById('transactionCurrency').value = 'USD';
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDesc').value = 'Compra de mercado (desde mi lista)';
    showToast('📋 Datos precargados desde tu lista');
}

function setSavingsGoal() {
    const desc = document.getElementById('savingsGoalDesc').value.trim();
    const currency = document.getElementById('savingsGoalCurrency').value;
    let amount = parseFloatFromLocalString(document.getElementById('savingsGoalInput').value);
    if (isNaN(amount) || amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

    let amountUSD = amount;
    if (currency === 'BS') {
        if (dollarRate <= 0) { showToast('⚠️ No hay tasa de cambio disponible'); return; }
        amountUSD = amount / dollarRate;
    }

    savingsGoalData = {
        amountUSD,
        description: desc,
        currency,
        originalAmount: amount,
        contributions: savingsGoalData ? savingsGoalData.contributions : []
    };
    saveFinanceData();
    renderSavingsGoal();
    showToast('🎯 Meta de ahorro actualizada');
}

function deleteSavingsGoal() {
    showConfirmModal(
        'Eliminar meta',
        '¿Estás seguro de eliminar esta meta de ahorro? Los abonos registrados no se perderán, pero dejarán de estar vinculados a una meta.',
        'Eliminar',
        () => {
            savingsGoalData = null;
            localStorage.removeItem('savings_goal');
            renderSavingsGoal();
            showToast('🗑️ Meta eliminada');
        }
    );
}

function addSavingsContribution() {
    if (!savingsGoalData || savingsGoalData.amountUSD <= 0) { showToast('⚠️ Primero establece una meta de ahorro'); return; }

    let amount = parseFloatFromLocalString(document.getElementById('savingsContributionAmount').value);
    if (isNaN(amount) || amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }

    let amountUSD = amount;
    if (savingsGoalData.currency === 'BS') {
        if (dollarRate <= 0) { showToast('⚠️ No hay tasa de cambio disponible'); return; }
        amountUSD = amount / dollarRate;
    }

    const desc = document.getElementById('savingsContributionDesc').value.trim() || 'Abono a meta de ahorro';

    const contribution = {
        id: Date.now(),
        amountUSD,
        description: desc,
        date: new Date().toISOString().split('T')[0]
    };

    savingsGoalData.contributions.push(contribution);

    // también registrar como ingreso
    transactions.push({
        id: Date.now() + 1,
        date: contribution.date,
        type: 'income',
        category: 'ahorro',
        amountUSD,
        description: `💰 ${desc}`,
        createdAt: new Date().toISOString()
    });

    saveFinanceData();
    renderSavingsGoal();
    renderFinanceSummary();

    document.getElementById('savingsContributionAmount').value = '';
    document.getElementById('savingsContributionDesc').value = '';
    showToast(`✅ Abono de ${formatUSD(amountUSD)} registrado`);
}

const savingsTips = [
    "Ahorra al menos el 10% de tus ingresos mensuales.",
    "Usa la calculadora de cobertura para planificar tus compras.",
    "Compara precios antes de comprar y aprovecha ofertas.",
    "Lleva un registro diario de tus gastos para identificar fugas.",
    "Evita las compras por impulso: haz una lista y síguela.",
    "Destina un porcentaje fijo de tus ingresos al ahorro antes de gastar.",
    "Revisa tus suscripciones mensuales y cancela las que no uses.",
    "Compra al por mayor productos no perecederos cuando estén en oferta."
];

function showRandomTip() {
    const tipDiv = document.getElementById('savingsTip');
    if (tipDiv) tipDiv.textContent = savingsTips[Math.floor(Math.random() * savingsTips.length)];
}

function setDefaultTransactionDate() {
    const dateInput = document.getElementById('transactionDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

// ===== CONTROL DEL MENÚ INFERIOR =====
function setupMenu() {
    const menuButtons = document.querySelectorAll('.menu-btn');
    if (menuButtons.length === 0) return;
    
    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.getAttribute('data-view');
            if (!viewName) return;
            
            // Remover clase active de todos los botones
            menuButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Remover clase active de todas las vistas
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            // Manejar clase main-view-active en body
            if (viewName === 'main') {
                document.body.classList.add('main-view-active');
            } else {
                document.body.classList.remove('main-view-active');
            }
            
            // Mostrar la vista seleccionada
            const targetView = document.getElementById(viewName + '-view');
            if (targetView) {
                targetView.classList.add('active');
                
                if (viewName === 'main') {
                    // Resetear al panel de lista (no calculadora)
                    currentPage = 0;
                    const wrapper = document.getElementById('pagesWrapper');
                    if (wrapper && window.innerWidth < 768) {
                        wrapper.style.transform = 'translateX(0)';
                        wrapper.style.width = '200%';
                    }
                    // Resetear hints del swipe
                    const hintRight = document.getElementById('swipeHintRight');
                    const hintLeft = document.getElementById('swipeHintLeft');
                    if (hintRight) hintRight.classList.remove('hidden');
                    if (hintLeft) hintLeft.classList.remove('visible');
                }
                
                if (viewName === 'finanzas') {
                    renderCharts();
                    renderStatistics();
                    renderTransactionHistory();
                }

                if (viewName === 'calendario') {
                    calendarViewDate = new Date();
                    selectedCalDay = null;
                    renderCalendar();
                }
            }
            
            updateFabVisibility();
        });
    });
}


// Acordeón FAQ
function setupFaq() {
    document.querySelectorAll('.faq-question').forEach(q => {
        q.parentElement.classList.remove('open');
        q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
    });
}

// ===== HISTORIAL DE TRANSACCIONES =====
function renderTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No hay transacciones registradas.</p></div>';
        return;
    }
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:0.75rem;color:var(--text-muted)">${transactions.length} transacciones</span>
        <button class="btn btn-sm btn-outline" onclick="clearAllTransactions()" style="color:var(--danger);border-color:var(--danger);">🗑️ Borrar todo</button>
    </div>`;
    html += `<div class="history-table"><div class="history-header">
        <span>Fecha</span><span>Tipo</span><span>Categoría</span><span>Monto</span><span>Descripción</span><span></span>
    </div>`;
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(tx => {
        const isIncome = tx.type === 'income';
        const sign = isIncome ? '+' : '-';
        const cls = isIncome ? 'positive' : 'negative';
        html += `<div class="history-row">
            <span class="history-date">${formatDateShort(tx.date)}</span>
            <span class="history-type">${isIncome ? '💰 Ingreso' : '💸 Gasto'}</span>
            <span class="history-cat">${getCategoryIcon(tx.category)} ${tx.category}</span>
            <span class="history-amount ${cls}">${sign}${formatUSD(tx.amountUSD)}</span>
            <span class="history-desc">${escapeHtml(tx.description)}</span>
            <button class="history-delete" onclick="deleteTransaction(${tx.id})" title="Eliminar">✕</button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
}

function getCategoryIcon(cat) {
    const icons = { comida: '🍔', bebida: '🥤', transporte: '🚗', deudas: '💳', servicios: '💡', otros: '📦', salario: '💼', freelance: '💻', inversion: '📈', ahorro: '🐷' };
    return icons[cat] || '📌';
}

function deleteTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    showConfirmModal(
        '🗑️ Eliminar transacción',
        `¿Eliminar la transacción "${tx ? tx.description : ''}" por ${tx ? formatUSD(tx.amountUSD) : ''}?`,
        'Eliminar',
        function() {
            transactions = transactions.filter(t => t.id !== id);
            saveFinanceData();
            renderTransactionHistory();
            renderFinanceSummary();
            if (tx) showToast(`🗑️ "${tx.description}" eliminado`);
        }
    );
}

function clearAllTransactions() {
    if (transactions.length === 0) return;
    showConfirmModal(
        '🗑️ Borrar todas',
        `¿Eliminar TODAS las ${transactions.length} transacciones? Esta acción no se puede deshacer.`,
        'Borrar todo',
        function() {
            transactions = [];
            saveFinanceData();
            renderTransactionHistory();
            renderFinanceSummary();
            renderStatistics();
            showToast('🗑️ Todas las transacciones eliminadas');
        }
    );
}

// ===== GRÁFICOS =====
function renderCharts() {
    const container = document.getElementById('chartsContainer');
    if (!container) return;
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Registra transacciones para ver gráficos.</p></div>';
        return;
    }
    container.innerHTML = '<div class="chart-grid"><div class="chart-card"><h4>💰 Ingresos vs Gastos (últimos 6 meses)</h4><canvas id="incomeExpenseChart"></canvas></div><div class="chart-card"><h4>🧩 Gastos por categoría</h4><canvas id="categoryChart"></canvas></div></div>';
    drawIncomeExpenseChart();
    drawCategoryChart();
}

function drawIncomeExpenseChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width - 32;
    canvas.width = w * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);

    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }) });
    }
    let incomeData = [], expenseData = [];
    months.forEach(m => {
        let inc = 0, exp = 0;
        transactions.forEach(tx => {
            const txd = new Date(tx.date + 'T12:00:00');
            if (txd.getFullYear() === m.year && txd.getMonth() === m.month) {
                if (tx.type === 'income') inc += tx.amountUSD;
                else exp += tx.amountUSD;
            }
        });
        incomeData.push(inc);
        expenseData.push(exp);
    });
    const maxVal = Math.max(...incomeData, ...expenseData, 1) * 1.2;
    const pad = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = w - pad.left - pad.right;
    const chartH = 200 - pad.top - pad.bottom;
    const barW = chartW / months.length * 0.3;
    const gap = chartW / months.length;

    ctx.clearRect(0, 0, w, 200);
    months.forEach((m, i) => {
        const x = pad.left + i * gap + (gap - barW * 2) / 2;
        const incH = (incomeData[i] / maxVal) * chartH;
        const expH = (expenseData[i] / maxVal) * chartH;
        ctx.fillStyle = '#00B894';
        ctx.fillRect(x, pad.top + chartH - incH, barW, incH);
        ctx.fillStyle = '#FF4757';
        ctx.fillRect(x + barW, pad.top + chartH - expH, barW, expH);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, pad.left + i * gap + gap / 2, 200 - 8);
        if (incomeData[i] > 0) {
            ctx.fillStyle = '#00B894';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('$' + Math.round(incomeData[i]), pad.left + i * gap + barW / 2, pad.top + chartH - incH - 4);
        }
        if (expenseData[i] > 0) {
            ctx.fillStyle = '#FF4757';
            ctx.fillText('$' + Math.round(expenseData[i]), pad.left + i * gap + barW + barW / 2, pad.top + chartH - expH - 4);
        }
    });
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💰 Ingresos', pad.left, 14);
    ctx.fillStyle = '#00B894';
    ctx.fillRect(pad.left + 52, 7, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';
    ctx.fillText('💸 Gastos', pad.left + 70, 14);
    ctx.fillStyle = '#FF4757';
    ctx.fillRect(pad.left + 120, 7, 10, 10);
}

function drawCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width - 32;
    canvas.width = w * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);

    const catTotals = {};
    const catColors = { comida: '#FF6B6B', bebida: '#4ECDC4', transporte: '#FFE66D', deudas: '#A29BFE', servicios: '#00CEC9', otros: '#636E72', salario: '#00B894', freelance: '#6C5CE7', inversion: '#FDCB6E', ahorro: '#27AE60' };
    let totalExpenses = 0;
    transactions.forEach(tx => {
        if (tx.type === 'expense') {
            catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amountUSD;
            totalExpenses += tx.amountUSD;
        }
    });
    if (totalExpenses === 0) {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sin gastos registrados', w / 2, 100);
        return;
    }
    const cats = Object.keys(catTotals);
    const cx = w * 0.35, cy = 100, radius = 70;
    let startAngle = -Math.PI / 2;
    cats.forEach((cat, i) => {
        const slice = (catTotals[cat] / totalExpenses) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = catColors[cat] || '#636E72';
        ctx.fill();
        startAngle += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-card').trim() || '#1A1A2E';
    ctx.fill();

    let legendY = 20;
    cats.forEach(cat => {
        const pct = Math.round((catTotals[cat] / totalExpenses) * 100);
        ctx.fillStyle = catColors[cat] || '#636E72';
        ctx.fillRect(w * 0.6, legendY, 12, 12);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${cat} ${pct}%`, w * 0.6 + 18, legendY + 10);
        legendY += 22;
    });
}

// ===== EXPORTAR DATOS =====
function exportTransactionsCSV() {
    if (transactions.length === 0) { showToast('⚠️ No hay transacciones para exportar'); return; }
    let csv = 'Fecha,Tipo,Categoría,Monto USD,Descripción\n';
    transactions.forEach(tx => {
        csv += `${tx.date},${tx.type},${tx.category},${tx.amountUSD},"${tx.description}"\n`;
    });
    downloadFile(csv, 'transacciones.csv', 'text/csv');
    showToast('✅ CSV exportado');
}

function exportTransactionsJSON() {
    if (transactions.length === 0) { showToast('⚠️ No hay transacciones para exportar'); return; }
    const data = JSON.stringify({ transactions, savingsGoalData, exportedAt: new Date().toISOString(), version: '2.0' }, null, 2);
    downloadFile(data, 'transacciones.json', 'application/json');
    showToast('✅ JSON exportado');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== MODO EDICIÓN DE PRODUCTOS =====
function enableEditProduct(id) {
    const prods = getProducts();
    const p = prods.find(x => x.id === id);
    if (!p) return;
    const container = document.getElementById('productList');
    if (!container) return;
    const item = container.querySelector(`.product-item[data-id="${id}"]`);
    if (!item) return;
    item.innerHTML = `
        <div class="edit-form-inline">
            <div class="edit-field"><label>Producto</label><input type="text" id="edit_name_${id}" value="${escapeHtml(p.name)}"></div>
            <div class="edit-field"><label>Cant</label><input type="text" id="edit_qty_${id}" value="${p.qty}" inputmode="numeric"></div>
            <div class="edit-field"><label>Und</label><input type="text" id="edit_unit_${id}" value="${escapeHtml(p.unit || '')}"></div>
            <div class="edit-field"><label>Precio</label><input type="text" id="edit_price_${id}" value="${p.price.toFixed(2)}" inputmode="numeric"></div>
            <div class="edit-actions">
                <button class="btn btn-sm btn-primary" onclick="saveEditProduct(${id})">💾</button>
                <button class="btn btn-sm btn-outline" onclick="cancelEditProduct(${id})">✕</button>
            </div>
        </div>`;
}

function saveEditProduct(id) {
    const name = document.getElementById(`edit_name_${id}`);
    const qty = document.getElementById(`edit_qty_${id}`);
    const unit = document.getElementById(`edit_unit_${id}`);
    const price = document.getElementById(`edit_price_${id}`);
    if (!name || !qty || !unit || !price) return;
    const newName = name.value.trim();
    const newQty = parseInt(parseFloatFromLocalString(qty.value)) || 1;
    const newUnit = unit.value.trim();
    const newPrice = parseFloatFromLocalString(price.value);
    if (!newName) { showToast('⚠️ El nombre no puede estar vacío'); return; }
    if (isNaN(newPrice) || newPrice <= 0) { showToast('⚠️ Precio inválido'); return; }
    const prods = getProducts();
    const p = prods.find(x => x.id === id);
    if (p) {
        p.name = newName;
        p.qty = newQty;
        p.unit = newUnit;
        p.price = newPrice;
        setProducts(prods);
        renderProducts();
        updateTotals();
        showToast('✅ Producto actualizado');
    }
}

function cancelEditProduct(id) {
    renderProducts();
}

// ===== ESCÁNER DE CÓDIGO DE BARRAS =====
let scannerStream = null;
let scannerActive = false;

function stopScanner() {
    scannerActive = false;
    if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
        scannerStream = null;
    }
    const overlay = document.getElementById('scannerOverlay');
    if (overlay) overlay.classList.remove('visible');
    const video = document.getElementById('scannerVideo');
    if (video) video.srcObject = null;
}

function setupBarcodeScanner() {
    const input = document.getElementById('barcodeInput');
    const btn = document.getElementById('barcodeScanBtn');
    if (!input || !btn) return;

    btn.addEventListener('click', async () => {
        if (!('BarcodeDetector' in window)) {
            input.focus();
            showToast('📷 Escanea escribiendo o pega el código');
            return;
        }
        try {
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            const formats = supportedFormats.filter(f => ['ean_13', 'ean_8', 'upc_a', 'code_39', 'code_128', 'qr_code', 'upc_e'].includes(f));
            if (formats.length === 0) {
                input.focus();
                showToast('📷 Escanea escribiendo o pega el código');
                return;
            }
            const detector = new BarcodeDetector({ formats });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
            scannerStream = stream;
            scannerActive = true;
            const overlay = document.getElementById('scannerOverlay');
            const video = document.getElementById('scannerVideo');
            if (!overlay || !video) { stopScanner(); return; }
            video.srcObject = stream;
            video.setAttribute('playsinline', '');
            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            await video.play();
            overlay.classList.add('visible');
            const scanLoop = async () => {
                if (!scannerActive) return;
                try {
                    const barcodes = await detector.detect(video);
                    if (barcodes.length > 0) {
                        const code = barcodes[0].rawValue;
                        stopScanner();
                        input.value = code;
                        lookupBarcodeProduct(code);
                        return;
                    }
                    requestAnimationFrame(scanLoop);
                } catch(e) {
                    requestAnimationFrame(scanLoop);
                }
            };
            scanLoop();
        } catch(e) {
            stopScanner();
            input.focus();
            showToast('📷 No se pudo acceder a la cámara, escribe el código');
        }
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            lookupBarcodeProduct(input.value.trim());
        }
    });
}

const barcodeProductDB = {
    '7591048001782': { name: 'Harina Pan', unit: '1Kg' },
    '7591048001799': { name: 'Harina Pan', unit: '500gr' },
    '7891000100107': { name: 'Leche La Serenísima', unit: '1L' },
    '7591001001004': { name: 'Arroz Primor', unit: '1Kg' },
    '7591002002003': { name: 'Azúcar Montaña', unit: '1Kg' },
    '7591003003002': { name: 'Aceite Mazola', unit: '1L' },
    '7591004004001': { name: 'Pasta Barilla', unit: '500gr' },
    '7591005005000': { name: 'Atún Golf', unit: '170gr' },
    '7591006006009': { name: 'Caraotas Negras', unit: '500gr' },
    '7591007007008': { name: 'Queso Manteco', unit: '500gr' },
    '7591008008007': { name: 'Margarina Mavesa', unit: '500gr' },
    '7591009009006': { name: 'Mayonesa Mavesa', unit: '400gr' },
    '7591010001005': { name: 'Salsa de Tomate', unit: '400gr' },
    '7591011002004': { name: 'Café Madrugada', unit: '250gr' },
    '7591012003003': { name: 'Chocolate El Rey', unit: '100gr' },
    '7591013004002': { name: 'Coca Cola', unit: '2L' },
    '7591014005001': { name: 'Cerveza Polar', unit: 'Lata' },
    '7591015006000': { name: 'Papel Higiénico', unit: '4und' },
    '7591016007009': { name: 'Jabón Las Llaves', unit: '170gr' },
    '7591017008008': { name: 'Cloro', unit: '1L' },
    '7591018009007': { name: 'Detergente', unit: '1Kg' },
    '7591019010004': { name: 'Desodorante', unit: 'und' },
    '7591020011003': { name: 'Shampoo Pantene', unit: '400ml' },
};

function lookupBarcodeProduct(code) {
    const product = barcodeProductDB[code];
    if (product) {
        document.getElementById('prodName').value = product.name;
        if (product.unit) document.getElementById('prodUnit').value = product.unit;
        document.getElementById('prodQty').value = '1';
        document.getElementById('prodPrice').focus();
        showToast(`📦 ${product.name} encontrado`);
    } else {
        document.getElementById('prodName').value = 'Código: ' + code;
        showToast('📦 Producto no encontrado, completa los datos');
        document.getElementById('prodName').focus();
    }
    document.getElementById('barcodeInput').value = '';
}

// ===== NOTIFICACIONES =====
let notificationReminderInterval = null;

function setupNotifications() {
    const toggle = document.getElementById('notificationToggle');
    const timeInput = document.getElementById('notificationTime');
    const daySelect = document.getElementById('notificationDay');
    if (!toggle || !timeInput || !daySelect) return;
    const savedPrefs = localStorage.getItem('notification_prefs');
    if (savedPrefs) {
        try {
            const prefs = JSON.parse(savedPrefs);
            toggle.checked = prefs.enabled || false;
            if (prefs.time) timeInput.value = prefs.time;
            if (prefs.day) daySelect.value = prefs.day;
        } catch(e) {}
    }
    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            scheduleNotificationReminder();
        } else {
            clearNotificationReminder();
        }
        saveNotifPrefs();
    });
    timeInput.addEventListener('change', saveNotifPrefs);
    daySelect.addEventListener('change', saveNotifPrefs);
    if (toggle.checked && 'Notification' in window && Notification.permission === 'granted') {
        scheduleNotificationReminder();
    }
}

function saveNotifPrefs() {
    const toggle = document.getElementById('notificationToggle');
    const timeInput = document.getElementById('notificationTime');
    const daySelect = document.getElementById('notificationDay');
    if (!toggle || !timeInput || !daySelect) return;
    localStorage.setItem('notification_prefs', JSON.stringify({
        enabled: toggle.checked,
        time: timeInput.value,
        day: daySelect.value
    }));
}

function scheduleNotificationReminder() {
    clearNotificationReminder();
    const timeInput = document.getElementById('notificationTime');
    const daySelect = document.getElementById('notificationDay');
    if (!timeInput || !daySelect) return;
    const [hours, minutes] = (timeInput.value || '09:00').split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const msUntilTarget = target - now;
    notificationReminderInterval = setTimeout(() => {
        sendNotification();
        notificationReminderInterval = setInterval(sendNotification, 24 * 60 * 60 * 1000);
    }, msUntilTarget);
}

function clearNotificationReminder() {
    if (notificationReminderInterval) {
        clearTimeout(notificationReminderInterval);
        clearInterval(notificationReminderInterval);
        notificationReminderInterval = null;
    }
}

function sendNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const daySelect = document.getElementById('notificationDay');
    const day = daySelect ? daySelect.value : 'daily';
    if (day !== 'daily') {
        const todayName = new Date().toLocaleDateString('es-VE', { weekday: 'long' }).toLowerCase();
        const daysMap = { monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo' };
        if (todayName !== (daysMap[day] || day)) return;
    }
    const prods = getProducts();
    const prodCount = prods.length;
    const txToday = transactions.filter(tx => {
        const txd = new Date(tx.date + 'T12:00:00');
        const today = new Date();
        return txd.getDate() === today.getDate() && txd.getMonth() === today.getMonth() && txd.getFullYear() === today.getFullYear();
    });
    let body = `📋 ${prodCount} productos en tu lista`;
    if (txToday.length > 0) {
        const total = txToday.reduce((s, t) => s + t.amountUSD, 0);
        body += ` | 💰 ${txToday.length} transacciones hoy (${formatUSD(total)})`;
    }
    try {
        new Notification('🛒 Mi Mercado - Recordatorio', { body, icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛒</text></svg>' });
    } catch(e) {}
}

// ===== ESTADÍSTICAS =====
function renderStatistics() {
    const container = document.getElementById('statisticsContainer');
    if (!container) return;
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Registra transacciones para ver estadísticas.</p></div>';
        return;
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let monthlyIncome = 0, monthlyExpense = 0;
    let totalIncome = 0, totalExpense = 0;
    let categoryTotals = {};
    let monthTotals = {};
    transactions.forEach(tx => {
        const txd = new Date(tx.date + 'T12:00:00');
        const key = `${txd.getFullYear()}-${txd.getMonth()}`;
        if (!monthTotals[key]) monthTotals[key] = { income: 0, expense: 0 };
        if (tx.type === 'income') {
            totalIncome += tx.amountUSD;
            monthTotals[key].income += tx.amountUSD;
            if (txd.getMonth() === currentMonth && txd.getFullYear() === currentYear) monthlyIncome += tx.amountUSD;
        } else {
            totalExpense += tx.amountUSD;
            monthTotals[key].expense += tx.amountUSD;
            categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amountUSD;
            if (txd.getMonth() === currentMonth && txd.getFullYear() === currentYear) monthlyExpense += tx.amountUSD;
        }
    });
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;
    const avgMonthlyExpense = Object.keys(monthTotals).length > 0 ? totalExpense / Object.keys(monthTotals).length : 0;
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

    let html = '<div class="stats-grid">';
    html += `<div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Ingresos totales</div><div class="stat-value positive">${formatUSD(totalIncome)}</div></div>`;
    html += `<div class="stat-card"><div class="stat-icon">💸</div><div class="stat-label">Gastos totales</div><div class="stat-value negative">${formatUSD(totalExpense)}</div></div>`;
    html += `<div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-label">Balance total</div><div class="stat-value ${balance >= 0 ? 'positive' : 'negative'}">${formatUSD(balance)}</div></div>`;
    html += `<div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Tasa de ahorro</div><div class="stat-value accent">${savingsRate.toFixed(1)}%</div></div>`;
    html += `<div class="stat-card"><div class="stat-icon">📅</div><div class="stat-label">Gasto promedio/mes</div><div class="stat-value">${formatUSD(avgMonthlyExpense)}</div></div>`;
    if (topCategory) {
        html += `<div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-label">Mayor gasto en</div><div class="stat-value">${getCategoryIcon(topCategory[0])} ${topCategory[0]} (${formatUSD(topCategory[1])})</div></div>`;
    }
    html += `<div class="stat-card"><div class="stat-icon">📆</div><div class="stat-label">Este mes (ingresos)</div><div class="stat-value positive">${formatUSD(monthlyIncome)}</div></div>`;
    html += `<div class="stat-card"><div class="stat-icon">📆</div><div class="stat-label">Este mes (gastos)</div><div class="stat-value negative">${formatUSD(monthlyExpense)}</div></div>`;
    html += '</div>';
    container.innerHTML = html;
}

// ===== SINCRONIZACIÓN (BACKUP / RESTORE) =====
function backupAllData() {
    const data = {
        version: '2.0',
        backedUpAt: new Date().toISOString(),
        marketLists,
        currentListId,
        transactions,
        savingsGoalData,
        dollarRate: localStorage.getItem('dollarRate') || '0',
        notificationPrefs: localStorage.getItem('notification_prefs') || '{}'
    };
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `backup-mi-mercado-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    showToast('✅ Backup descargado');
}

function restoreAllData() {
    const input = document.getElementById('restoreFileInput');
    if (!input) return;
    input.click();
}

function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version) throw new Error('Versión inválida');
            if (data.marketLists) {
                marketLists = data.marketLists;
                localStorage.setItem('market_lists_v2', JSON.stringify(marketLists));
            }
            if (data.currentListId) {
                currentListId = data.currentListId;
                localStorage.setItem('currentListId', currentListId);
            }
            if (data.transactions) {
                transactions = data.transactions;
                localStorage.setItem('finance_transactions', JSON.stringify(transactions));
            }
            if (data.savingsGoalData) {
                savingsGoalData = data.savingsGoalData;
                localStorage.setItem('savings_goal', JSON.stringify(savingsGoalData));
            } else if (data.savingsGoal) {
                // migrar desde backup antiguo
                const old = parseFloat(data.savingsGoal);
                savingsGoalData = old > 0 ? { amountUSD: old, description: '', currency: 'USD', originalAmount: old, contributions: [] } : null;
                localStorage.setItem('savings_goal', JSON.stringify(savingsGoalData));
            }
            if (data.dollarRate && parseFloat(data.dollarRate) > 0) {
                localStorage.setItem('dollarRate', data.dollarRate);
                dollarRate = parseFloat(data.dollarRate);
            }
            if (data.notificationPrefs) {
                localStorage.setItem('notification_prefs', data.notificationPrefs);
            }
            renderListTitle();
            renderProducts();
            updateTotals();
            renderFinanceSummary();
            renderTransactionHistory();
            renderCharts();
            renderStatistics();
            renderSavingsGoal();
            showToast('✅ Datos restaurados correctamente');
        } catch(err) {
            showToast('❌ Archivo de backup inválido');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ===== MODALES PROFESIONALES (reemplazan prompt/confirm) =====
let promptCallback = null;
let confirmCallback = null;

function showPromptModal(title, desc, label, placeholder, defaultValue, callback) {
    document.getElementById('promptTitle').textContent = title;
    document.getElementById('promptDesc').textContent = desc;
    document.getElementById('promptLabel').textContent = label;
    const input = document.getElementById('promptInput');
    input.placeholder = placeholder;
    input.value = defaultValue || '';
    promptCallback = callback;
    document.getElementById('promptModal').classList.add('visible');
    setTimeout(() => input.focus(), 100);
}

function closePromptModal() {
    document.getElementById('promptModal').classList.remove('visible');
    promptCallback = null;
}

function confirmPromptModal() {
    const value = document.getElementById('promptInput').value.trim();
    if (!value) {
        document.getElementById('promptInput').style.borderColor = 'var(--danger)';
        setTimeout(() => document.getElementById('promptInput').style.borderColor = '', 1500);
        return;
    }
    if (promptCallback) promptCallback(value);
    closePromptModal();
}

function showConfirmModal(title, message, btnText, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const btn = document.getElementById('confirmActionBtn');
    btn.textContent = btnText || 'Eliminar';
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.add('visible');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('visible');
    confirmCallback = null;
}

function executeConfirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

// ===== CAMBIO A VISTA PRINCIPAL =====
function switchToMainView() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const mainView = document.getElementById('main-view');
    if (mainView) mainView.classList.add('active');
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const mainBtn = document.querySelector('.menu-btn[data-view="main"]');
    if (mainBtn) mainBtn.classList.add('active');
    document.body.classList.add('main-view-active');

    const wrapper = document.getElementById('pagesWrapper');
    if (wrapper) {
        if (window.innerWidth < 768) {
            wrapper.style.transform = 'translateX(0)';
            wrapper.style.width = '200%';
        } else {
            wrapper.style.transform = 'none';
            wrapper.style.width = '100%';
        }
    }
    currentPage = 0;

    const hintRight = document.getElementById('swipeHintRight');
    const hintLeft = document.getElementById('swipeHintLeft');
    if (hintRight) hintRight.classList.remove('hidden');
    if (hintLeft) hintLeft.classList.remove('visible');
    updateFabVisibility();
}

// ===== CALENDARIO MENSUAL =====
let calendarViewDate = new Date();
let selectedCalDay = null;

function renderCalendar() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const today = new Date();
    const grid = document.getElementById('calGrid');
    const title = document.getElementById('calTitle');
    if (!grid || !title) return;

    title.textContent = new Date(year, month).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const txData = getCalendarMonthData(year, month);
    const weekData = getCalendarWeekData(year, month, firstDay, daysInMonth, txData);

    let html = '';
    let dayCount = 0;
    let weekIndex = 0;

    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day cal-other-month"><span>${daysInPrevMonth - i}</span></div>`;
        dayCount++;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const isSelected = dateStr === selectedCalDay;
        const dayData = txData[d];

        let classes = 'cal-day';
        if (isToday) classes += ' cal-today';
        if (isSelected) classes += ' cal-selected';

        let dotHtml = '';
        let amountHtml = '';
        let bgClass = '';

        if (dayData) {
            if (dayData.income > 0 && dayData.expense > 0) {
                bgClass = 'cal-bg-mix';
            } else if (dayData.income > 0) {
                bgClass = 'cal-bg-green';
            } else if (dayData.expense > 0) {
                const exp = dayData.expense;
                if (exp <= 10) bgClass = 'cal-bg-red-1';
                else if (exp <= 30) bgClass = 'cal-bg-red-2';
                else if (exp <= 100) bgClass = 'cal-bg-red-3';
                else bgClass = 'cal-bg-red-4';
            }
            if (dayData.income > 0 || dayData.expense > 0) {
                const net = dayData.income - dayData.expense;
                amountHtml = `<span class="cal-day-amount">${net >= 0 ? '+' : ''}${net.toFixed(0)}</span>`;
                dotHtml = `<span class="cal-day-dot" style="background:${net >= 0 ? 'var(--success)' : 'var(--expense-red)'}"></span>`;
            }
        }

        if (bgClass) classes += ' ' + bgClass;

        html += `<div class="${classes}" data-date="${dateStr}">`;
        html += `<span>${d}</span>${amountHtml}${dotHtml}</div>`;
        dayCount++;

        if (dayCount % 7 === 0 && weekIndex < weekData.length) {
            const w = weekData[weekIndex];
            html += `<div class="cal-week-row">
                <span class="wr-label">Sem ${weekIndex + 1}</span>
                ${w.income > 0 ? `<span class="wr-income">+${formatUSD(w.income)}</span>` : ''}
                ${w.expense > 0 ? `<span class="wr-expense">-${formatUSD(w.expense)}</span>` : ''}
                ${w.income === 0 && w.expense === 0 ? '<span style="color:var(--text-dim)">—</span>' : ''}
            </div>`;
            weekIndex++;
        }
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-day cal-other-month"><span>${i}</span></div>`;
        dayCount++;
        if (dayCount % 7 === 0 && weekIndex < weekData.length) {
            const w = weekData[weekIndex];
            html += `<div class="cal-week-row">
                <span class="wr-label">Sem ${weekIndex + 1}</span>
                ${w.income > 0 ? `<span class="wr-income">+${formatUSD(w.income)}</span>` : ''}
                ${w.expense > 0 ? `<span class="wr-expense">-${formatUSD(w.expense)}</span>` : ''}
                ${w.income === 0 && w.expense === 0 ? '<span style="color:var(--text-dim)">—</span>' : ''}
            </div>`;
            weekIndex++;
        }
    }

    grid.innerHTML = html;
    updateCalendarSummary(year, month);
}

function getCalendarMonthData(year, month) {
    const data = {};
    const filtered = transactions.filter(tx => {
        const d = new Date(tx.date + 'T12:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });
    filtered.forEach(tx => {
        const day = new Date(tx.date + 'T12:00:00').getDate();
        if (!data[day]) data[day] = { income: 0, expense: 0 };
        if (tx.type === 'income') data[day].income += tx.amountUSD;
        else data[day].expense += tx.amountUSD;
    });
    return data;
}

function getCalendarWeekData(year, month, firstDay, daysInMonth, txData) {
    const weeks = [];
    let week = { income: 0, expense: 0 };
    let col = 0;

    for (let i = 0; i < firstDay; i++) {
        col++;
        if (col % 7 === 0) { weeks.push(week); week = { income: 0, expense: 0 }; }
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const data = txData[d];
        if (data) {
            week.income += data.income || 0;
            week.expense += data.expense || 0;
        }
        col++;
        if (col % 7 === 0) { weeks.push(week); week = { income: 0, expense: 0 }; }
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
        col++;
        if (col % 7 === 0) { weeks.push(week); week = { income: 0, expense: 0 }; }
    }

    if (week.income > 0 || week.expense > 0) weeks.push(week);
    return weeks;
}

function navigateCalendar(delta) {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + delta);
    selectedCalDay = null;
    closeQuickForm();
    renderCalendar();
    resetDayPanel();
}

function resetDayPanel() {
    const list = document.getElementById('calDayList');
    const title = document.getElementById('calDayTitle');
    const count = document.getElementById('calDayCount');
    const totals = document.getElementById('calDayTotals');
    if (list) list.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Toca un día del calendario para ver sus transacciones.</p></div>';
    if (title) title.textContent = 'Selecciona un día';
    if (count) count.textContent = '';
    if (totals) totals.classList.remove('visible');
}

function selectCalendarDay(el) {
    const dateStr = el.dataset.date;
    if (!dateStr) return;
    selectedCalDay = dateStr;
    closeQuickForm();
    renderCalendar();

    const dayTitle = document.getElementById('calDayTitle');
    const dayCount = document.getElementById('calDayCount');
    const dayList = document.getElementById('calDayList');
    const dayTotals = document.getElementById('calDayTotals');
    if (!dayTitle || !dayCount || !dayList) return;

    const parts = dateStr.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    dayTitle.textContent = date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });

    const dayTxs = transactions.filter(tx => tx.date === dateStr);
    let dayIncome = 0, dayExpense = 0;
    dayTxs.forEach(tx => {
        if (tx.type === 'income') dayIncome += tx.amountUSD;
        else dayExpense += tx.amountUSD;
    });

    if (dayTotals) {
        if (dayIncome > 0 || dayExpense > 0) {
            dayTotals.innerHTML = `
                <span class="cal-dt-item positive">+${formatUSD(dayIncome)}</span>
                <span class="cal-dt-item negative">-${formatUSD(dayExpense)}</span>
                <span class="cal-dt-item ${dayIncome - dayExpense >= 0 ? 'positive' : 'negative'}">= ${formatUSD(dayIncome - dayExpense)}</span>`;
            dayTotals.classList.add('visible');
        } else {
            dayTotals.classList.remove('visible');
        }
    }

    if (dayTxs.length === 0) {
        dayCount.textContent = 'Sin movimientos';
        dayList.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No hay transacciones en esta fecha. Usa el botón + para agregar.</p></div>';
        return;
    }

    dayCount.textContent = `${dayTxs.length} movimiento${dayTxs.length !== 1 ? 's' : ''}`;
    let html = '';
    const sorted = [...dayTxs].sort((a, b) => b.id - a.id);
    sorted.forEach(tx => {
        const isIncome = tx.type === 'income';
        const sign = isIncome ? '+' : '-';
        const cls = isIncome ? 'positive' : 'negative';
        html += `<div class="history-row">
            <span class="history-type">${isIncome ? '💰 Ingreso' : '💸 Gasto'}</span>
            <span class="history-amount ${cls}">${sign}${formatUSD(tx.amountUSD)}</span>
            <span class="history-desc">${escapeHtml(tx.description)}</span>
            <button class="history-delete" data-txid="${tx.id}" title="Eliminar">✕</button>
        </div>`;
    });
    dayList.innerHTML = html;
}

function deleteFromCalendar(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    showConfirmModal(
        '🗑️ Eliminar',
        `¿Eliminar "${tx.description}" por ${formatUSD(tx.amountUSD)}?`,
        'Eliminar',
        function() {
            transactions = transactions.filter(t => t.id !== id);
            saveFinanceData();
            renderFinanceSummary();
            renderCalendar();
            if (selectedCalDay) {
                const selEl = document.querySelector(`.cal-day[data-date="${selectedCalDay}"]`);
                if (selEl) selectCalendarDay(selEl);
            }
            showToast(`🗑️ "${tx.description}" eliminado`);
        }
    );
}

function updateCalendarSummary(year, month) {
    const incomeEl = document.getElementById('calIncome');
    const expenseEl = document.getElementById('calExpense');
    const balanceEl = document.getElementById('calBalance');
    if (!incomeEl || !expenseEl || !balanceEl) return;

    let totalIncome = 0, totalExpense = 0;
    transactions.forEach(tx => {
        const d = new Date(tx.date + 'T12:00:00');
        if (d.getFullYear() === year && d.getMonth() === month) {
            if (tx.type === 'income') totalIncome += tx.amountUSD;
            else totalExpense += tx.amountUSD;
        }
    });
    const balance = totalIncome - totalExpense;
    incomeEl.textContent = formatUSD(totalIncome);
    expenseEl.textContent = formatUSD(totalExpense);
    balanceEl.textContent = formatUSD(balance);
    balanceEl.style.color = balance >= 0 ? '' : 'var(--expense-red)';
}

// ===== FORMULARIO RÁPIDO =====
let quickFormActive = false;

function toggleQuickForm() {
    const form = document.getElementById('calQuickForm');
    if (!form) return;
    quickFormActive = !quickFormActive;
    form.classList.toggle('visible', quickFormActive);
}

function closeQuickForm() {
    const form = document.getElementById('calQuickForm');
    if (form) form.classList.remove('visible');
    quickFormActive = false;
}

function saveQuickTransaction() {
    if (!selectedCalDay) { showToast('⚠️ Selecciona un día primero'); return; }
    const type = document.getElementById('qfType').value;
    const category = document.getElementById('qfCategory').value;
    const amountRaw = document.getElementById('qfAmount').value.trim();
    const currency = document.getElementById('qfCurrency').value;
    const desc = document.getElementById('qfDesc').value.trim();

    if (!amountRaw) { showToast('⚠️ Ingresa un monto'); return; }
    let amountUSD = parseFloatFromLocalString(amountRaw);
    if (isNaN(amountUSD) || amountUSD <= 0) { showToast('⚠️ Monto inválido'); return; }
    if (currency === 'BS') {
        if (dollarRate <= 0) { showToast('⚠️ No hay tasa de cambio'); return; }
        amountUSD = amountUSD / dollarRate;
    }

    transactions.push({
        id: Date.now(),
        date: selectedCalDay,
        type,
        category,
        amountUSD,
        description: desc || (type === 'income' ? 'Ingreso rápido' : 'Gasto rápido'),
        createdAt: new Date().toISOString()
    });
    saveFinanceData();
    renderFinanceSummary();
    renderCalendar();
    const selEl = document.querySelector(`.cal-day[data-date="${selectedCalDay}"]`);
    if (selEl) selectCalendarDay(selEl);
    closeQuickForm();
    document.getElementById('qfAmount').value = '';
    document.getElementById('qfDesc').value = '';
    showToast('✅ Movimiento registrado');
}

// ===== EXPORTAR MES =====
function exportCalendarMonth() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const monthTxs = transactions.filter(tx => {
        const d = new Date(tx.date + 'T12:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });
    if (monthTxs.length === 0) { showToast('⚠️ No hay transacciones este mes'); return; }
    const monthName = new Date(year, month).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
    let csv = `Fecha,Tipo,Categoría,Monto USD,Descripción\n`;
    monthTxs.forEach(tx => {
        csv += `${tx.date},${tx.type},${tx.category},${tx.amountUSD},"${tx.description}"\n`;
    });
    downloadFile(csv, `transacciones-${monthName.replace(/ /g,'-')}.csv`, 'text/csv');
    showToast('✅ Mes exportado');
}

// ===== SELECTOR RÁPIDO DE MES =====
function toggleMonthPicker() {
    const picker = document.getElementById('calMonthPicker');
    if (!picker) return;
    const isOpen = picker.classList.contains('visible');
    if (isOpen) { picker.classList.remove('visible'); return; }
    const year = calendarViewDate.getFullYear();
    const currentMonth = calendarViewDate.getMonth();
    const grid = document.getElementById('calMpGrid');
    if (!grid) return;
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    grid.innerHTML = months.map((m, i) =>
        `<div class="cal-mp-item ${i === currentMonth ? 'cal-mp-current' : ''}" data-m="${i}">${m}</div>`
    ).join('');
    picker.classList.add('visible');
}

function jumpToMonth(monthIndex) {
    calendarViewDate.setMonth(parseInt(monthIndex));
    selectedCalDay = null;
    closeQuickForm();
    document.getElementById('calMonthPicker')?.classList.remove('visible');
    renderCalendar();
    resetDayPanel();
}

// ===== DONACIONES: COPIAR AL PORTAPAPELES =====
function copyDonation(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Copiado al portapapeles');
        }).catch(() => {
            fallbackCopyDonation(text);
        });
    } else {
        fallbackCopyDonation(text);
    }
}

function fallbackCopyDonation(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('📋 Copiado al portapapeles');
    } catch(e) {
        showToast('⚠️ No se pudo copiar, selecciona manualmente');
    }
    document.body.removeChild(ta);
}

// Inicializar todo al cargar (adicional)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('promptInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmPromptModal();
    });
    document.getElementById('backToMainBtn')?.addEventListener('click', switchToMainView);
    document.querySelectorAll('.view-back-btn').forEach(btn => {
        btn.addEventListener('click', switchToMainView);
    });
    document.getElementById('scannerCloseBtn')?.addEventListener('click', () => {
        stopScanner();
        showToast('✋ Escaneo cancelado');
    });

    // Calendario: event delegation para clicks en días (incluye otros meses)
    document.getElementById('calGrid')?.addEventListener('click', e => {
        const dayEl = e.target.closest('.cal-day');
        if (!dayEl) return;
        if (dayEl.classList.contains('cal-other-month')) {
            const prevBtn = document.getElementById('calPrevBtn');
            const nextBtn = document.getElementById('calNextBtn');
            const idx = Array.from(dayEl.parentNode.children).indexOf(dayEl);
            const weekdayPos = idx % 7;
            if (weekdayPos < 3) navigateCalendar(1);
            else navigateCalendar(-1);
            return;
        }
        selectCalendarDay(dayEl);
    });

    document.getElementById('calPrevBtn')?.addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('calNextBtn')?.addEventListener('click', () => navigateCalendar(1));

    // Calendario: event delegation para botones eliminar en el panel de día
    document.getElementById('calDayList')?.addEventListener('click', e => {
        const btn = e.target.closest('.history-delete');
        if (btn && btn.dataset.txid) deleteFromCalendar(parseInt(btn.dataset.txid));
    });

    // Calendario: formulario rápido
    document.getElementById('calQuickAddBtn')?.addEventListener('click', toggleQuickForm);
    document.getElementById('qfSaveBtn')?.addEventListener('click', saveQuickTransaction);
    document.getElementById('qfCancelBtn')?.addEventListener('click', closeQuickForm);

    // Calendario: exportar mes
    document.getElementById('calExportBtn')?.addEventListener('click', exportCalendarMonth);

    // Calendario: selector de meses (click en título)
    document.getElementById('calTitle')?.addEventListener('click', toggleMonthPicker);

    // Calendario: event delegation para clicks en meses del picker
    document.getElementById('calMpGrid')?.addEventListener('click', e => {
        const item = e.target.closest('.cal-mp-item');
        if (item && item.dataset.m !== undefined) jumpToMonth(item.dataset.m);
    });

    // Calendario: swipe horizontal táctil
    let calTouchStartX = 0;
    let calTouchStartY = 0;
    const calGrid = document.getElementById('calGrid');
    if (calGrid) {
        calGrid.addEventListener('touchstart', e => {
            calTouchStartX = e.touches[0].clientX;
            calTouchStartY = e.touches[0].clientY;
        }, { passive: true });
        calGrid.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - calTouchStartX;
            const dy = e.changedTouches[0].clientY - calTouchStartY;
            if (Math.abs(dx) > 50 && Math.abs(dy) < Math.abs(dx) * 0.7) {
                if (dx < 0) navigateCalendar(1);
                else navigateCalendar(-1);
            }
        }, { passive: true });
    }
    setTimeout(() => {
        setupBarcodeScanner();
        setupNotifications();
        renderTransactionHistory();
        renderCharts();
        renderStatistics();
    }, 100);
});
