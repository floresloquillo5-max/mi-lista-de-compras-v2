import { AppState } from '../state';
import { saveLists, persistCurrentListId } from '../utils/storage';
import { escapeHtml } from '../utils/format';
import { $, $empty, createElement, showToast, truncate, closeConfirmModal, showConfirmModal, downloadFile } from '../utils/dom';
import { renderProducts } from './products';
import { updateTotals } from './finances';

function generateId(): string {
  return 'list_' + Date.now();
}

export function renderListTitle(): void {
  const list = AppState.getCurrentList();
  const titleEl = document.getElementById('listTitle');
  if (!titleEl) return;
  $empty(titleEl);
  titleEl.textContent = `📋 ${list.name} `;
  const editBtn = createElement('button', { className: 'btn-icon', 'data-action': 'editListName', title: 'Renombrar' });
  editBtn.textContent = '✏️';
  titleEl.appendChild(editBtn);
}

export function updateListSelector(): void {
  const select = document.getElementById('listSelect') as HTMLSelectElement | null;
  if (!select) return;

  $empty(select);
  Object.values(AppState.state.marketLists).forEach(list => {
    const count = (list.products || []).length;
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = `${list.name} (${count})`;
    if (list.id === AppState.state.currentListId) option.selected = true;
    select.appendChild(option);
  });
}

export function switchList(id: string): void {
  if (!AppState.state.marketLists[id]) return;
  AppState.state.currentListId = id;
  persistCurrentListId();
  renderListTitle();
  renderProducts();
  updateTotals();
  showToast(`📋 Lista "${AppState.state.marketLists[id].name}" cargada`);
}

export function createNewList(): void {
  showPromptModal(
    '✏️ Nueva Lista',
    'Ingresa el nombre para la nueva lista',
    'Nombre de la lista',
    'Ej: Mercado Semanal',
    'Lista ' + (Object.keys(AppState.state.marketLists).length + 1),
    function(name: string) {
      const id = generateId();
      AppState.state.marketLists[id] = { id, name: name.trim(), products: [], createdAt: new Date().toISOString() };
      saveLists();
      AppState.state.currentListId = id;
      persistCurrentListId();
      renderListTitle();
      renderProducts();
      updateTotals();
      updateListSelector();
      showToast(`✅ Lista "${name.trim()}" creada`);
    }
  );
}

export function copyCurrentList(): void {
  const src = AppState.getCurrentList();
  showPromptModal(
    '📋 Copiar Lista',
    'Ingresa un nombre para la copia',
    'Nombre de la copia',
    'Ej: ' + src.name + ' (respaldo)',
    src.name + ' (copia)',
    function(name: string) {
      const id = generateId();
      AppState.state.marketLists[id] = {
        id, name: name.trim(),
        products: JSON.parse(JSON.stringify(src.products || [])).map((p: { id: number }, i: number) => ({ ...p, id: Date.now() + i + 1 })),
        createdAt: new Date().toISOString(),
      };
      saveLists();
      AppState.state.currentListId = id;
      persistCurrentListId();
      renderListTitle();
      renderProducts();
      updateTotals();
      updateListSelector();
      showToast(`📋 Lista copiada como "${name.trim()}"`);
    }
  );
}

export function deleteCurrentList(): void {
  if (AppState.state.currentListId === 'default') {
    showToast('⚠️ No se puede eliminar la lista principal');
    return;
  }
  showConfirmModal(
    '🗑️ Eliminar Lista',
    `¿Eliminar la lista "${AppState.getCurrentList().name}"? Esta acción no se puede deshacer.`,
    'Eliminar',
    function() {
      delete AppState.state.marketLists[AppState.state.currentListId];
      AppState.state.currentListId = 'default';
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

export function exportCurrentList(): void {
  const list = AppState.getCurrentList();
  const data = { name: list.name, products: list.products || [] };
  const json = JSON.stringify(data, null, 2);
  const safeName = list.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_') || 'lista';
  const filename = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(json, filename, 'application/json');
  showToast(`📥 Archivo "${filename}" descargado`);
}

export function openImportModal(): void {
  const modal = document.getElementById('importModal');
  if (modal) modal.classList.add('visible');
}

export function closeImportModal(): void {
  const modal = document.getElementById('importModal');
  if (modal) modal.classList.remove('visible');
  const fileInput = document.getElementById('importFileInput') as HTMLInputElement | null;
  if (fileInput) fileInput.value = '';
}

export function editListName(): void {
  const input = document.getElementById('newListName') as HTMLInputElement | null;
  if (input) input.value = AppState.getCurrentList().name;
  const modal = document.getElementById('renameModal');
  if (modal) modal.classList.add('visible');
}

export function closeRenameModal(): void {
  const modal = document.getElementById('renameModal');
  if (modal) modal.classList.remove('visible');
}

export function saveListName(): void {
  const nameInput = document.getElementById('newListName') as HTMLInputElement | null;
  if (!nameInput) return;
  const name = truncate(nameInput.value.trim(), 60);
  if (!name) { showToast('⚠️ Ingresa un nombre válido'); return; }
  AppState.getCurrentList().name = name;
  saveLists();
  renderListTitle();
  closeRenameModal();
  showToast('✅ Nombre actualizado');
}

function processImportData(data: unknown, suggestedName: string): void {
  if (!data || typeof data !== 'object') { showToast('❌ Formato inválido'); return; }
  const d = data as Record<string, unknown>;
  if (typeof d.name !== 'string' || !Array.isArray(d.products)) {
    showToast('❌ Formato inválido: debe tener "name" y "products"');
    return;
  }
  showPromptModal(
    '📥 Importar Lista',
    'Ingresa un nombre para la lista importada',
    'Nombre',
    'Ej: ' + d.name,
    suggestedName,
    function(name: string) {
      const id = generateId();
      AppState.state.marketLists[id] = {
        id, name: name.trim(),
        products: (d.products as Record<string, unknown>[]).map((p: Record<string, unknown>, i: number) => ({
          id: Date.now() + i + 1,
          name: String(p.name || 'Producto'),
          qty: parseInt(String(p.qty)) || 1,
          unit: String(p.unit || ''),
          price: parseFloat(String(p.price)) || 0,
          checked: p.checked !== undefined ? !!p.checked : true,
        })),
        createdAt: new Date().toISOString(),
      };
      saveLists();
      AppState.state.currentListId = id;
      persistCurrentListId();
      renderListTitle();
      renderProducts();
      updateTotals();
      closeImportModal();
      showToast(`✅ Lista "${name.trim()}" importada`);
    }
  );
}

export function handleImportListFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      processImportData(data, (data.name || 'Lista') + ' (importada)');
    } catch {
      showToast('❌ Archivo JSON inválido');
    }
  };
  reader.readAsText(file);
}

/* Prompt modal functions used across modules */
let promptCallback: ((val: string) => void) | null = null;

export function showPromptModal(
  title: string, desc: string, label: string, placeholder: string,
  defaultValue: string, callback: (val: string) => void
): void {
  const titleEl = document.getElementById('promptTitle');
  const descEl = document.getElementById('promptDesc');
  const labelEl = document.getElementById('promptLabel');
  const input = document.getElementById('promptInput') as HTMLInputElement | null;
  const modal = document.getElementById('promptModal');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (labelEl) labelEl.textContent = label;
  if (input) {
    input.placeholder = placeholder;
    input.value = defaultValue;
    setTimeout(() => input.focus(), 100);
  }
  promptCallback = callback;
  if (modal) modal.classList.add('visible');
}

export function closePromptModal(): void {
  const modal = document.getElementById('promptModal');
  if (modal) modal.classList.remove('visible');
  promptCallback = null;
}

export function confirmPromptModal(): void {
  const input = document.getElementById('promptInput') as HTMLInputElement | null;
  const val = truncate(input ? input.value.trim() : '', 60);
  if (!val) { showToast('⚠️ Este campo es obligatorio'); return; }
  const cb = promptCallback;
  closePromptModal();
  if (cb) cb(val);
}
