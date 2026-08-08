const sections = Array.from(document.querySelectorAll('[data-section]'));
const panels = Array.from(document.querySelectorAll('.panel'));
const itemGrid = document.getElementById('item-grid');
const itemSearch = document.getElementById('item-search');
const itemDetail = document.getElementById('item-detail');
const lowStockAlerts = document.getElementById('low-stock-alerts');
const dashboardTotalItems = document.getElementById('dashboard-total-items');
const dashboardLowStock = document.getElementById('dashboard-low-stock');
const dashboardOutOfStock = document.getElementById('dashboard-out-of-stock');
const dashboardTransactions = document.getElementById('dashboard-transactions');
const refreshItemsButton = document.getElementById('refresh-items');
const itemForm = document.getElementById('item-form');
const itemFormMessage = document.getElementById('item-form-message');
const itemImageInput = document.getElementById('item-image-input');
const imagePreview = document.getElementById('image-preview');
const imageUploadPlaceholder = document.getElementById('image-upload-placeholder');
const stockForm = document.getElementById('stock-form');
const stockSkuSelect = document.getElementById('stock-sku-select');
const stockCurrentInfo = document.getElementById('stock-current-info');
const stockCurrentQty = document.getElementById('stock-current-qty');
const stockCurrentUnit = document.getElementById('stock-current-unit');
const stockQtyInput = stockForm.querySelector('input[name="qty"]');
const stockPreview = document.getElementById('stock-preview');
const stockInButton = document.getElementById('stock-in');
const stockOutButton = document.getElementById('stock-out');
const stockFormMessage = document.getElementById('stock-form-message');
const reportType = document.getElementById('report-type');
const reportFrom = document.getElementById('report-from');
const reportTo = document.getElementById('report-to');
const runReportButton = document.getElementById('run-report');
const reportOutput = document.getElementById('report-output');

const outOfStockGrid = document.getElementById('outofstock-grid');
const refreshOutOfStockButton = document.getElementById('refresh-outofstock');

const updateSkuSelect = document.getElementById('update-sku-select');
const updateFormWrap = document.getElementById('update-form-wrap');
const updateForm = document.getElementById('update-form');
const updateFormMessage = document.getElementById('update-form-message');
const updateSku = document.getElementById('update-sku');
const updateName = document.getElementById('update-name');
const updateCategory = document.getElementById('update-category');
const updateUnit = document.getElementById('update-unit');
const updateCost = document.getElementById('update-cost');
const updateQuantity = document.getElementById('update-quantity');
const updateImageInput = document.getElementById('update-image-input');
const updateImagePreview = document.getElementById('update-image-preview');
const updateImagePlaceholder = document.getElementById('update-image-upload-placeholder');

const recentSalesList = document.getElementById('recent-sales-list');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
const logoutButton = document.getElementById('logout-button');

const themeToggle = document.getElementById('theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');

const reportExportRow = document.getElementById('report-export-row');
const exportCsvButton = document.getElementById('export-csv');
const exportPdfButton = document.getElementById('export-pdf');

const exportBackupButton = document.getElementById('export-backup');
const restoreFileInput = document.getElementById('restore-file-input');
const restoreBackupButton = document.getElementById('restore-backup');
const restoreMessage = document.getElementById('restore-message');
const backupList = document.getElementById('backup-list');

let lastReportData = null;
let lastReportType = 'inventory';

const pageTitle = document.getElementById('page-title');
const refreshAllButton = document.getElementById('refresh-all');
const titles = {
  dashboard: 'Dashboard',
  items: 'Items',
  manage: 'Manage Stock',
  outofstock: 'Sold Out / Out of Stock',
  update: 'Update Item',
  reports: 'Reports',
  backup: 'Backup & Restore',
};

let currentItems = [];
let pendingImageData = '';
let pendingUpdateImageData = '';

/* ---------- theme (dark mode) ---------- */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeToggleLabel) {
    themeToggleLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function initTheme() {
  const saved = localStorage.getItem('stockroom-theme');
  const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('stockroom-theme', next);
  });
}

initTheme();

function switchPanel(targetId) {
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
  sections.forEach((button) => button.classList.toggle('active', button.dataset.section === targetId));
  if (pageTitle && titles[targetId]) {
    pageTitle.textContent = titles[targetId];
  }
  hideMessage(itemFormMessage);
  hideMessage(stockFormMessage);
}

sections.forEach((button) => {
  button.addEventListener('click', () => switchPanel(button.dataset.section));
});

const heroButtons = document.querySelectorAll('.hero-buttons button');
heroButtons.forEach((button) => {
  button.addEventListener('click', () => switchPanel(button.dataset.section));
});

function showMessage(element, text, success = true) {
  element.textContent = text;
  element.classList.remove('error', 'success');
  element.classList.add(success ? 'success' : 'error');
}

function hideMessage(element) {
  element.textContent = '';
  element.classList.remove('error', 'success');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function stockStatus(item) {
  if (item.quantity <= 0) return 'out-stock';
  if (item.quantity <= item.reorderLevel) return 'low-stock';
  return 'in-stock';
}

function stockLabel(status) {
  if (status === 'out-stock') return 'Out of stock';
  if (status === 'low-stock') return 'Low stock';
  return 'In stock';
}

/* ---------- image upload ---------- */

if (itemImageInput) {
  itemImageInput.addEventListener('change', () => {
    const file = itemImageInput.files && itemImageInput.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showMessage(itemFormMessage, 'Picture is too large. Please choose one under 4 MB.', false);
      itemImageInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageData = reader.result;
      imagePreview.src = pendingImageData;
      imagePreview.hidden = false;
      imageUploadPlaceholder.hidden = true;
    };
    reader.readAsDataURL(file);
  });
}

function resetImageUpload() {
  pendingImageData = '';
  if (itemImageInput) itemImageInput.value = '';
  if (imagePreview) {
    imagePreview.hidden = true;
    imagePreview.src = '';
  }
  if (imageUploadPlaceholder) imageUploadPlaceholder.hidden = false;
}

/* ---------- items grid ---------- */

function renderItemGrid(items, container) {
  const target = container || itemGrid;
  if (items.length === 0) {
    target.innerHTML = '<div class="empty-state">No items match here — add one from the Manage Stock tab.</div>';
    return;
  }
  target.innerHTML = items.map((item) => {
    const status = stockStatus(item);
    const thumb = item.imageUrl
      ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" loading="lazy" />`
      : '<span class="no-image">&#128230;</span>';
    return `
      <div class="item-card ${status === 'out-stock' ? 'out-of-stock' : ''}">
        <div class="item-thumb">
          ${thumb}
          <span class="stock-badge ${status}">${stockLabel(status)}</span>
        </div>
        <div class="item-card-body">
          <div class="item-card-title">${escapeHtml(item.name)}</div>
          <span class="sku-tag">${escapeHtml(item.sku)}</span>
          <div class="item-card-meta">
            <span>${escapeHtml(item.category) || 'Uncategorized'}</span>
            <span class="item-card-qty">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</span>
          </div>
          <div class="item-card-meta">
            <span>Cost</span>
            <span>${formatCurrency(item.unitCost)}</span>
          </div>
          <div class="item-card-actions">
            <button class="action-button view" data-sku="${escapeHtml(item.sku)}">View</button>
            <button class="action-button delete" data-sku="${escapeHtml(item.sku)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function applyItemFilter() {
  const query = (itemSearch.value || '').trim().toLowerCase();
  if (!query) {
    renderItemGrid(currentItems);
    return;
  }
  const filtered = currentItems.filter((item) =>
    item.name.toLowerCase().includes(query) ||
    item.sku.toLowerCase().includes(query) ||
    (item.category || '').toLowerCase().includes(query)
  );
  renderItemGrid(filtered);
}

if (itemSearch) {
  itemSearch.addEventListener('input', applyItemFilter);
}

function renderItemDetail(item, transactions) {
  const status = stockStatus(item);
  const thumb = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width:96px;height:96px;object-fit:cover;border-radius:0.7rem;border:1px solid var(--line);" />`
    : '';
  itemDetail.innerHTML = `
    <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
      ${thumb}
      <div>
        <h2>${escapeHtml(item.name)} <span class="sku-tag">${escapeHtml(item.sku)}</span> <span class="stock-badge ${status}" style="position:static;display:inline-flex;">${stockLabel(status)}</span></h2>
        <p><strong>Category:</strong> ${escapeHtml(item.category) || '—'}</p>
        <p><strong>Quantity:</strong> ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</p>
        <p><strong>Unit cost:</strong> ${formatCurrency(item.unitCost)}</p>
        <p><strong>Reorder level:</strong> ${escapeHtml(item.reorderLevel)}</p>
        <p><strong>Stock value:</strong> ${formatCurrency(item.unitCost * item.quantity)}</p>
      </div>
    </div>
    <h3>Recent transactions</h3>
    ${transactions.length > 0 ? '<ul>' + transactions.slice(-10).reverse().map((txn) => `<li>${escapeHtml(txn.date)} — ${txn.type === 'IN' ? 'Received' : 'Sold/issued'} ${escapeHtml(txn.quantity)} ${escapeHtml(item.unit)} ${txn.party ? `— ${escapeHtml(txn.party)}` : ''} ${txn.reference ? `[${escapeHtml(txn.reference)}]` : ''} ${escapeHtml(txn.note) || ''}</li>`).join('') + '</ul>' : '<p>No transactions found.</p>'}
  `;
}

function renderDashboard(items, transactions, lowStock) {
  dashboardTotalItems.textContent = items.length;
  dashboardLowStock.textContent = lowStock.filter((item) => item.quantity > 0).length;
  dashboardOutOfStock.textContent = items.filter((item) => item.quantity <= 0).length;
  dashboardTransactions.textContent = transactions.length;
  if (lowStock.length === 0) {
    lowStockAlerts.innerHTML = '<p>All items are above reorder thresholds.</p>';
    return;
  }
  lowStockAlerts.innerHTML = lowStock
    .map((item) => {
      const status = stockStatus(item);
      return `<div class="alert-item"><span class="sku-tag">${escapeHtml(item.sku)}</span> <span>${escapeHtml(item.name)} has ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} left (reorder ${escapeHtml(item.reorderLevel)}).</span> <span class="stock-badge ${status}" style="position:static;margin-left:auto;">${stockLabel(status)}</span></div>`;
    })
    .join('');
}

/* ---------- stock movement dropdown ---------- */

function populateStockSelect(items) {
  const currentValue = stockSkuSelect.value;
  stockSkuSelect.innerHTML = '<option value="">Select a product&hellip;</option>' +
    items.map((item) => `<option value="${escapeHtml(item.sku)}">${escapeHtml(item.name)} (${escapeHtml(item.sku)}) — ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</option>`).join('');
  if (currentValue && items.some((item) => item.sku === currentValue)) {
    stockSkuSelect.value = currentValue;
  }
  updateStockPreview();
}

function selectedStockItem() {
  return currentItems.find((item) => item.sku === stockSkuSelect.value);
}

function updateStockPreview() {
  const item = selectedStockItem();
  if (!item) {
    stockCurrentInfo.hidden = true;
    stockPreview.hidden = true;
    return;
  }
  stockCurrentInfo.hidden = false;
  stockCurrentQty.textContent = item.quantity;
  stockCurrentUnit.textContent = item.unit;

  const qty = Number(stockQtyInput.value);
  if (!qty || qty <= 0) {
    stockPreview.hidden = true;
    return;
  }
  stockPreview.hidden = false;
  const afterIn = item.quantity + qty;
  const afterOut = item.quantity - qty;
  if (afterOut < 0) {
    stockPreview.className = 'stock-preview bad';
    stockPreview.textContent = `Only ${item.quantity} ${item.unit} available — cannot stock out ${qty}.`;
  } else {
    stockPreview.className = 'stock-preview ok';
    stockPreview.textContent = `Stock in → ${afterIn} ${item.unit}  ·  Stock out → ${afterOut} ${item.unit}`;
  }
}

stockSkuSelect.addEventListener('change', updateStockPreview);
stockQtyInput.addEventListener('input', updateStockPreview);

function statusBadgeClass(status) {
  if (status === 'out-of-stock') return 'out-stock';
  if (status === 'low-stock') return 'low-stock';
  return 'in-stock';
}

function renderInventoryTable(rows) {
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>SKU</th><th>Name</th><th>Status</th><th>Remaining</th><th>Received</th><th>Sold</th><th>Stock value</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><span class="sku-tag">${escapeHtml(row.sku)}</span></td>
              <td>${escapeHtml(row.name)}</td>
              <td><span class="stock-badge ${statusBadgeClass(row.status)}" style="position:static;display:inline-flex;">${stockLabel(statusBadgeClass(row.status))}</span></td>
              <td>${escapeHtml(row.remaining)} ${escapeHtml(row.unit)}</td>
              <td>${escapeHtml(row.totalReceived)} ${escapeHtml(row.unit)}</td>
              <td>${escapeHtml(row.totalSold)} ${escapeHtml(row.unit)}</td>
              <td>${formatCurrency(row.stockValue)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (response.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || response.statusText);
  }
  return response.json();
}

async function loadCurrentUser() {
  try {
    const data = await fetchJson('/api/me');
    sidebarUserName.textContent = data.email;
    sidebarUserAvatar.textContent = data.email.charAt(0).toUpperCase();
  } catch (error) {
    // fetchJson already redirects on 401
  }
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login.html';
  });
}

async function refreshItems() {
  try {
    const data = await fetchJson('/api/items');
    currentItems = data.items;
    applyItemFilter();
    populateStockSelect(data.items);
    populateUpdateSelect(data.items);
    renderOutOfStockGrid(data.items);
    const lowStockData = await fetchJson('/api/low-stock');
    const transactionData = await fetchJson('/api/report?type=transactions');
    renderDashboard(data.items, transactionData.transactions, lowStockData.lowStock);
    renderRecentSales(transactionData.transactions, data.items);
    hideMessage(itemFormMessage);
    hideMessage(stockFormMessage);
  } catch (error) {
    itemGrid.innerHTML = `<div class="empty-state">Unable to load items: ${escapeHtml(error.message)}</div>`;
  }
}

/* ---------- sold out / out of stock view ---------- */

function renderRecentSales(transactions, items) {
  if (!recentSalesList) return;
  const sales = transactions
    .filter((txn) => txn.type === 'OUT')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);
  if (sales.length === 0) {
    recentSalesList.innerHTML = '<p>No sales recorded yet.</p>';
    return;
  }
  recentSalesList.innerHTML = sales.map((txn) => {
    const item = items.find((entry) => entry.sku === txn.sku);
    const name = item ? item.name : txn.sku;
    const unit = item ? item.unit : '';
    return `<div class="alert-item"><span class="sku-tag">${escapeHtml(txn.sku)}</span> <span>${escapeHtml(name)} — sold ${escapeHtml(txn.quantity)} ${escapeHtml(unit)} on ${escapeHtml(txn.date)} ${txn.party ? `to ${escapeHtml(txn.party)}` : ''} ${txn.reference ? `[${escapeHtml(txn.reference)}]` : ''}</span></div>`;
  }).join('');
}

function renderOutOfStockGrid(items) {
  const soldOut = items.filter((item) => item.quantity <= 0);
  if (soldOut.length === 0) {
    outOfStockGrid.innerHTML = '<div class="empty-state">Nothing is out of stock right now.</div>';
    return;
  }
  renderItemGrid(soldOut, outOfStockGrid);
}

if (refreshOutOfStockButton) {
  refreshOutOfStockButton.addEventListener('click', refreshItems);
}

/* ---------- update item view ---------- */

function populateUpdateSelect(items) {
  const currentValue = updateSkuSelect.value;
  updateSkuSelect.innerHTML = '<option value="">Select a product&hellip;</option>' +
    items.map((item) => `<option value="${escapeHtml(item.sku)}">${escapeHtml(item.name)} (${escapeHtml(item.sku)})</option>`).join('');
  if (currentValue && items.some((item) => item.sku === currentValue)) {
    updateSkuSelect.value = currentValue;
  }
}

function loadItemIntoUpdateForm(item) {
  updateSku.value = item.sku;
  updateName.value = item.name;
  updateCategory.value = item.category || '';
  updateUnit.value = item.unit;
  updateCost.value = item.unitCost;
  updateQuantity.value = item.quantity;
  pendingUpdateImageData = '';
  updateImageInput.value = '';
  if (item.imageUrl) {
    updateImagePreview.src = item.imageUrl;
    updateImagePreview.hidden = false;
    updateImagePlaceholder.hidden = true;
  } else {
    updateImagePreview.hidden = true;
    updateImagePreview.src = '';
    updateImagePlaceholder.hidden = false;
  }
  updateFormWrap.hidden = false;
  hideMessage(updateFormMessage);
}

if (updateSkuSelect) {
  updateSkuSelect.addEventListener('change', () => {
    const item = currentItems.find((entry) => entry.sku === updateSkuSelect.value);
    if (!item) {
      updateFormWrap.hidden = true;
      return;
    }
    loadItemIntoUpdateForm(item);
  });
}

if (updateImageInput) {
  updateImageInput.addEventListener('change', () => {
    const file = updateImageInput.files && updateImageInput.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showMessage(updateFormMessage, 'Picture is too large. Please choose one under 4 MB.', false);
      updateImageInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingUpdateImageData = reader.result;
      updateImagePreview.src = pendingUpdateImageData;
      updateImagePreview.hidden = false;
      updateImagePlaceholder.hidden = true;
    };
    reader.readAsDataURL(file);
  });
}

if (updateForm) {
  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sku = updateSku.value;
    if (!sku) return;
    const payload = {
      name: updateName.value,
      category: updateCategory.value,
      unit: updateUnit.value,
      unitCost: updateCost.value,
      quantity: updateQuantity.value,
    };
    if (pendingUpdateImageData) {
      payload.imageUrl = pendingUpdateImageData;
    }
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(error.error || 'Update failed');
      }
      showMessage(updateFormMessage, 'Item updated successfully.', true);
      refreshItems();
    } catch (error) {
      showMessage(updateFormMessage, error.message, false);
    }
  });
}

async function handleItemGridClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const sku = button.dataset.sku;
  if (button.classList.contains('view')) {
    try {
      const data = await fetchJson(`/api/items/${sku}`);
      renderItemDetail(data.item, data.transactions);
      switchPanel('items');
      itemDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      showMessage(itemFormMessage, error.message, false);
    }
  }
  if (button.classList.contains('delete')) {
    if (!confirm(`Delete item ${sku}?`)) return;
    try {
      const response = await fetch(`/api/items/${sku}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(error.error || 'Delete failed');
      }
      refreshItems();
      showMessage(itemFormMessage, `Item ${sku} deleted.`, true);
    } catch (error) {
      showMessage(itemFormMessage, error.message, false);
    }
  }
}

itemGrid.addEventListener('click', handleItemGridClick);
if (outOfStockGrid) {
  outOfStockGrid.addEventListener('click', handleItemGridClick);
}

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(itemForm);
  const payload = Object.fromEntries(formData.entries());
  delete payload.imageFile;
  if (pendingImageData) {
    payload.imageUrl = pendingImageData;
  }
  await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Save failed' }));
      throw new Error(error.error || 'Save failed');
    }
    return response.json();
  }).then(() => {
    showMessage(itemFormMessage, 'Item saved successfully.', true);
    itemForm.reset();
    resetImageUpload();
    refreshItems();
  }).catch((error) => {
    showMessage(itemFormMessage, error.message, false);
  });
});

async function submitStock(type) {
  const formData = new FormData(stockForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.sku) {
    showMessage(stockFormMessage, 'Choose a product first.', false);
    return;
  }
  try {
    await fetch(`/api/stock-${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
      }
      return response.json();
    });
    showMessage(stockFormMessage, `Stock ${type === 'in' ? 'received' : 'issued'} successfully.`, true);
    const keepSku = stockSkuSelect.value;
    stockForm.reset();
    stockSkuSelect.value = keepSku;
    refreshItems();
  } catch (error) {
    showMessage(stockFormMessage, error.message, false);
  }
}

stockInButton.addEventListener('click', () => submitStock('in'));
stockOutButton.addEventListener('click', () => submitStock('out'));
refreshItemsButton.addEventListener('click', refreshItems);
if (refreshAllButton) {
  refreshAllButton.addEventListener('click', refreshItems);
}

runReportButton.addEventListener('click', async () => {
  const type = reportType.value;
  const from = reportFrom.value;
  const to = reportTo.value;
  try {
    const response = await fetch(`/api/report?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unable to generate report' }));
      throw new Error(error.error || 'Unable to generate report');
    }
    const data = await response.json();
    lastReportData = data;
    lastReportType = type;
    if (reportExportRow) reportExportRow.hidden = false;
    if (type === 'inventory') {
      reportOutput.innerHTML = `<div class="report-card">
        <h3>Inventory detail</h3>
        <p class="block-sub" style="margin-bottom:0.75rem;">${data.inventory.length} item${data.inventory.length === 1 ? '' : 's'} in the catalog</p>
        ${data.inventory.length ? renderInventoryTable(data.inventory) : '<p>No items found.</p>'}
      </div>`;
    } else if (type === 'low-stock') {
      reportOutput.innerHTML = `<div class="report-card"><h3>Low stock</h3>${data.lowStock.length ? '<ul>' + data.lowStock.map((item) => `<li><span class="sku-tag">${escapeHtml(item.sku)}</span> ${escapeHtml(item.name)} (${escapeHtml(item.quantity)} ${escapeHtml(item.unit)})</li>`).join('') + '</ul>' : '<p>All items are stocked above reorder level.</p>'}</div>`;
    } else {
      reportOutput.innerHTML = `<div class="report-card"><h3>Transactions</h3>${data.transactions.length ? '<ul>' + data.transactions.map((txn) => `<li>${escapeHtml(txn.date)} — <span class="sku-tag">${escapeHtml(txn.sku)}</span> ${txn.type === 'IN' ? 'Received' : 'Sold/issued'} ${escapeHtml(txn.quantity)} ${txn.party ? `— ${escapeHtml(txn.party)}` : ''} — ${escapeHtml(txn.reference) || 'No ref'} — ${escapeHtml(txn.note) || 'No note'}</li>`).join('') + '</ul>' : '<p>No transactions found.</p>'}</div>`;
    }
  } catch (error) {
    if (reportExportRow) reportExportRow.hidden = true;
    reportOutput.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
  }
});

/* ---------- report export (CSV / PDF) ---------- */

function reportRows() {
  if (!lastReportData) return { headers: [], rows: [] };
  if (lastReportType === 'inventory') {
    return {
      headers: ['SKU', 'Name', 'Status', 'Remaining', 'Received', 'Sold', 'Stock value'],
      rows: lastReportData.inventory.map((row) => [
        row.sku, row.name, stockLabel(statusBadgeClass(row.status)), row.remaining, row.totalReceived, row.totalSold, row.stockValue,
      ]),
    };
  }
  if (lastReportType === 'low-stock') {
    return {
      headers: ['SKU', 'Name', 'Quantity', 'Unit'],
      rows: lastReportData.lowStock.map((item) => [item.sku, item.name, item.quantity, item.unit]),
    };
  }
  return {
    headers: ['Date', 'SKU', 'Type', 'Quantity', 'Customer/Vendor', 'Reference', 'Note'],
    rows: lastReportData.transactions.map((txn) => [
      txn.date, txn.sku, txn.type === 'IN' ? 'Received' : 'Sold', txn.quantity, txn.party || '', txn.reference || '', txn.note || '',
    ]),
  };
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

if (exportCsvButton) {
  exportCsvButton.addEventListener('click', () => {
    const { headers, rows } = reportRows();
    if (rows.length === 0) return;
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    downloadFile(`stockroom-${lastReportType}-report.csv`, csv, 'text/csv;charset=utf-8');
  });
}

if (exportPdfButton) {
  exportPdfButton.addEventListener('click', () => {
    const { headers, rows } = reportRows();
    if (rows.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const titleText = lastReportType.charAt(0).toUpperCase() + lastReportType.slice(1) + ' report';
    win.document.write(`
      <html>
      <head>
        <title>${titleText}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1c1f26; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.meta { color: #726c60; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; text-align: left; }
          th { background: #f0ede4; }
        </style>
      </head>
      <body>
        <h1>Stockroom — ${titleText}</h1>
        <p class="meta">Generated ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  });
}

/* ---------- backup & restore ---------- */

async function loadBackupList() {
  if (!backupList) return;
  try {
    const data = await fetchJson('/api/backup/list');
    if (!data.backups || data.backups.length === 0) {
      backupList.innerHTML = '<p>No automatic backups yet — one is created the first time the server runs each day.</p>';
      return;
    }
    backupList.innerHTML = data.backups.map((stamp) => `<div class="alert-item"><span class="sku-tag mono">${escapeHtml(stamp)}</span> <span>Saved in backups/${escapeHtml(stamp)}/</span></div>`).join('');
  } catch (error) {
    backupList.innerHTML = `<p>Unable to load backups: ${escapeHtml(error.message)}</p>`;
  }
}

if (exportBackupButton) {
  exportBackupButton.addEventListener('click', () => {
    window.location.href = '/api/backup/export';
  });
}

if (restoreBackupButton) {
  restoreBackupButton.addEventListener('click', async () => {
    const file = restoreFileInput.files && restoreFileInput.files[0];
    if (!file) {
      showMessage(restoreMessage, 'Choose a backup file first.', false);
      return;
    }
    if (!confirm('This will replace all current items and transactions with the backup file. Continue?')) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const response = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Restore failed.');
      }
      showMessage(restoreMessage, result.message || 'Restored successfully.', true);
      restoreFileInput.value = '';
      refreshItems();
    } catch (error) {
      showMessage(restoreMessage, error.message, false);
    }
  });
}

window.addEventListener('load', () => {
  loadCurrentUser();
  refreshItems();
  loadBackupList();
});
