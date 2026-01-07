// frontend/js/admin.js - ПОЛНЫЙ КОД С АВТОРИЗАЦИЕЙ

const API_URL = '/api';

// Токен авторизации
let authToken = localStorage.getItem('adminToken');

// Состояние
const adminState = {
    orders: [],
    directions: [],
    slots: {},
    settings: {},
    currentOrder: null,
    currentDirectionId: null
};

// ==================== АВТОРИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
});

async function checkAuth() {
    if (!authToken) {
        showLoginScreen();
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/auth/check`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        
        if (data.authorized) {
            showAdminPanel();
        } else {
            localStorage.removeItem('adminToken');
            authToken = null;
            showLoginScreen();
        }
    } catch (e) {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            errorEl.classList.add('hidden');
            showAdminPanel();
        } else {
            errorEl.classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
        }
    } catch (e) {
        errorEl.classList.remove('hidden');
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    } catch (e) {}
    
    localStorage.removeItem('adminToken');
    authToken = null;
    location.reload();
}

async function showAdminPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    
    initNavigation();
    initMobileMenu();
    await loadOrders();
    await loadDirections();
    await loadSettings();
    initEventListeners();
}

// Добавляем токен ко всем запросам
async function fetchWithAuth(url, options = {}) {
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`
    };
    
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }
    
    return res;
}

// ==================== НАВИГАЦИЯ ====================

function initNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            
            document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            // Закрываем мобильное меню
            closeMobileMenu();
            
            if (sectionId === 'orders') loadOrders();
            if (sectionId === 'directions') loadDirections();
            if (sectionId === 'slots') loadDirectionsForSlots();
        });
    });
}

function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
        document.body.classList.toggle('menu-open');
    });
    
    overlay.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
    document.body.classList.remove('menu-open');
}

function initEventListeners() {
    document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
    document.getElementById('deleteCompletedBtn').addEventListener('click', deleteCompletedOrders);
    document.getElementById('directionForm').addEventListener('submit', handleDirectionSave);
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSave);
    document.getElementById('slotForm').addEventListener('submit', handleSlotSave);
}

// ==================== ЗАЯВКИ ====================

async function loadOrders() {
    try {
        const status = document.getElementById('orderStatusFilter').value;
        let url = `${API_URL}/admin/orders`;
        if (status) url += `?status=${status}`;
        
        const res = await fetchWithAuth(url);
        adminState.orders = await res.json();
        renderOrdersTable();
        renderOrdersCards();
    } catch (e) {
        if (e.message !== 'Unauthorized') {
            showToast('Ошибка загрузки заявок', 'error');
        }
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    
    if (adminState.orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">Заявки не найдены</td>
            </tr>
        `;
        return;
    }
    
    const cargoNames = { boxes: 'Короба', pallets: 'Палеты', mono_pallets: 'Моно-палеты' };
    const statusNames = {
        new: 'Новая', confirmed: 'Подтверждена', in_progress: 'В работе',
        completed: 'Завершена', cancelled: 'Отменена'
    };
    
    tbody.innerHTML = adminState.orders.map(order => `
        <tr onclick="openOrderModal('${order.orderNumber}')">
            <td><span class="table-order-number">${order.orderNumber}</span></td>
            <td>${order.direction?.name || '—'}</td>
            <td>
                <div class="table-client-name">${order.contact?.name || '—'}</div>
                <div class="table-client-phone">${order.contact?.phone || ''}</div>
            </td>
            <td>${formatDate(order.deliveryDate)}</td>
            <td>${cargoNames[order.cargoType] || order.cargoType} × ${order.quantity}</td>
            <td><span class="status-badge status-${order.status}">${statusNames[order.status]}</span></td>
            <td><button class="btn btn-ghost btn-sm">→</button></td>
        </tr>
    `).join('');
}

function renderOrdersCards() {
    const container = document.getElementById('ordersCards');
    
    if (adminState.orders.length === 0) {
        container.innerHTML = '<p class="empty-message">Заявки не найдены</p>';
        return;
    }
    
    const cargoNames = { boxes: 'Короба', pallets: 'Палеты', mono_pallets: 'Моно-палеты' };
    const statusNames = {
        new: 'Новая', confirmed: 'Подтверждена', in_progress: 'В работе',
        completed: 'Завершена', cancelled: 'Отменена'
    };
    
    container.innerHTML = adminState.orders.map(order => `
        <div class="order-card" onclick="openOrderModal('${order.orderNumber}')">
            <div class="order-card-header">
                <span class="order-card-number">${order.orderNumber}</span>
                <span class="status-badge status-${order.status}">${statusNames[order.status]}</span>
            </div>
            <div class="order-card-body">
                <div class="order-card-row">
                    <span class="label">Направление</span>
                    <span class="value">${order.direction?.name || '—'}</span>
                </div>
                <div class="order-card-row">
                    <span class="label">Клиент</span>
                    <span class="value">${order.contact?.name || '—'}</span>
                </div>
                <div class="order-card-row">
                    <span class="label">Дата поставки</span>
                    <span class="value">${formatDate(order.deliveryDate)}</span>
                </div>
                <div class="order-card-row">
                    <span class="label">Груз</span>
                    <span class="value">${cargoNames[order.cargoType]} × ${order.quantity}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function openOrderModal(orderNumber) {
    const order = adminState.orders.find(o => o.orderNumber === orderNumber);
    if (!order) return;
    
    adminState.currentOrder = order;
    
    document.getElementById('orderModalNumber').textContent = order.orderNumber;
    document.getElementById('orderStatusSelect').value = order.status;
    
    const cargoNames = { boxes: 'Короба', pallets: 'Палеты', mono_pallets: 'Моно-палеты' };
    const methodNames = { pickup: 'Забор', dropoff: 'Привоз клиентом' };
    
    document.getElementById('orderModalContent').innerHTML = `
        <div class="order-details">
            <div class="order-detail-row">
                <span class="order-detail-label">Направление</span>
                <span class="order-detail-value">${order.direction?.name || '—'}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Дата поставки</span>
                <span class="order-detail-value">${formatDate(order.deliveryDate)}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}</span>
                <span class="order-detail-value">${formatDate(order.pickupDate)}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Способ</span>
                <span class="order-detail-value">${methodNames[order.deliveryMethod] || order.deliveryMethod}</span>
            </div>
            ${order.pickupAddress ? `
                <div class="order-detail-row">
                    <span class="order-detail-label">Адрес забора</span>
                    <span class="order-detail-value">${order.pickupAddress}</span>
                </div>
            ` : ''}
            <div class="order-detail-row">
                <span class="order-detail-label">Груз</span>
                <span class="order-detail-value">${cargoNames[order.cargoType]} × ${order.quantity}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Клиент</span>
                <span class="order-detail-value">${order.contact?.name || '—'}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Телефон</span>
                <span class="order-detail-value">
                    <a href="tel:${order.contact?.phone}">${order.contact?.phone || '—'}</a>
                </span>
            </div>
            ${order.contact?.telegram ? `
                <div class="order-detail-row">
                    <span class="order-detail-label">Telegram</span>
                    <span class="order-detail-value">
                        <a href="https://t.me/${order.contact.telegram.replace('@', '')}" target="_blank">
                            ${order.contact.telegram}
                        </a>
                    </span>
                </div>
            ` : ''}
            ${order.comment ? `
                <div class="order-detail-row">
                    <span class="order-detail-label">Комментарий</span>
                    <span class="order-detail-value">${order.comment}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('orderModal').classList.remove('hidden');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.add('hidden');
    adminState.currentOrder = null;
}

async function updateOrderStatus() {
    if (!adminState.currentOrder) return;
    
    const newStatus = document.getElementById('orderStatusSelect').value;
    
    try {
        await fetchWithAuth(`${API_URL}/admin/orders/${adminState.currentOrder.orderNumber}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        showToast('Статус обновлён', 'success');
        await loadOrders();
        adminState.currentOrder.status = newStatus;
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function sendToTelegram() {
    if (!adminState.currentOrder) return;
    
    try {
        await fetchWithAuth(`${API_URL}/admin/orders/${adminState.currentOrder.orderNumber}/telegram`, {
            method: 'POST'
        });
        showToast('Отправлено в Telegram', 'success');
    } catch (e) {
        showToast('Ошибка отправки', 'error');
    }
}

async function deleteCurrentOrder() {
    if (!adminState.currentOrder) return;
    if (!confirm(`Удалить заявку ${adminState.currentOrder.orderNumber}?`)) return;
    
    try {
        await fetchWithAuth(`${API_URL}/admin/orders/${adminState.currentOrder.orderNumber}`, {
            method: 'DELETE'
        });
        showToast('Заявка удалена', 'success');
        closeOrderModal();
        await loadOrders();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function deleteCompletedOrders() {
    if (!confirm('Удалить все завершённые и отменённые заявки?')) return;
    
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/orders/completed`, {
            method: 'DELETE'
        });
        const result = await res.json();
        showToast(`Удалено: ${result.deleted}`, 'success');
        await loadOrders();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

// ==================== НАПРАВЛЕНИЯ ====================

async function loadDirections() {
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/directions`);
        adminState.directions = await res.json();
        renderDirectionsTable();
    } catch (e) {}
}

function renderDirectionsTable() {
    const tbody = document.getElementById('directionsTableBody');
    
    if (adminState.directions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Направления не добавлены</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminState.directions.map(dir => `
        <tr>
            <td><strong>${dir.name}</strong></td>
            <td><code>${dir.code}</code></td>
            <td>
                <span class="status-badge ${dir.active ? 'status-confirmed' : 'status-cancelled'}">
                    ${dir.active ? 'Активно' : 'Неактивно'}
                </span>
            </td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="editDirection(${dir.id})">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteDirection(${dir.id})">🗑</button>
            </td>
        </tr>
    `).join('');
}

function showDirectionModal(direction = null) {
    document.getElementById('directionModalTitle').textContent = 
        direction ? 'Редактировать' : 'Добавить направление';
    document.getElementById('directionId').value = direction?.id || '';
    document.getElementById('directionName').value = direction?.name || '';
    document.getElementById('directionCode').value = direction?.code || '';
    document.getElementById('directionActive').checked = direction?.active !== false;
    document.getElementById('directionModal').classList.remove('hidden');
}

function editDirection(id) {
    const dir = adminState.directions.find(d => d.id === id);
    if (dir) showDirectionModal(dir);
}

function closeDirectionModal() {
    document.getElementById('directionModal').classList.add('hidden');
}

async function handleDirectionSave(e) {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('directionName').value.trim(),
        code: document.getElementById('directionCode').value.trim().toUpperCase(),
        active: document.getElementById('directionActive').checked
    };
    
    const id = document.getElementById('directionId').value;
    if (id) data.id = parseInt(id);
    
    try {
        await fetchWithAuth(`${API_URL}/admin/directions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Сохранено', 'success');
        closeDirectionModal();
        await loadDirections();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function deleteDirection(id) {
    if (!confirm('Удалить направление?')) return;
    
    try {
        await fetchWithAuth(`${API_URL}/admin/directions/${id}`, { method: 'DELETE' });
        showToast('Удалено', 'success');
        await loadDirections();
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

// ==================== СЛОТЫ ====================

async function loadDirectionsForSlots() {
    await loadDirections();
    renderSlotsDirections();
}

function renderSlotsDirections() {
    const container = document.getElementById('slotsDirectionsList');
    
    container.innerHTML = adminState.directions.map(dir => `
        <div class="slots-direction-item ${adminState.currentDirectionId === dir.id ? 'active' : ''}" 
             onclick="selectDirectionForSlots(${dir.id}, '${dir.name}')">
            ${dir.name}
        </div>
    `).join('');
}

async function selectDirectionForSlots(directionId, directionName) {
    adminState.currentDirectionId = directionId;
    renderSlotsDirections();
    
    document.getElementById('slotsPlaceholder').classList.add('hidden');
    document.getElementById('slotsEditor').classList.remove('hidden');
    document.getElementById('slotsDirectionName').textContent = directionName;
    
    await loadSlotsForDirection(directionId);
}

async function loadSlotsForDirection(directionId) {
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/slots/${directionId}`);
        const slots = await res.json();
        adminState.slots[directionId] = slots;
        renderSlotsList(slots);
    } catch (e) {}
}

function renderSlotsList(slots) {
    const container = document.getElementById('slotsList');
    
    if (slots.length === 0) {
        container.innerHTML = '<p class="empty-message">Даты не добавлены</p>';
        return;
    }
    
    slots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    container.innerHTML = slots.map(slot => {
        const date = new Date(slot.date);
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        
        return `
            <div class="slot-card">
                <button class="slot-card-delete" onclick="deleteSlot('${slot.date}')">×</button>
                <div class="slot-card-date">${dateStr}</div>
                <div class="slot-card-day">${dayName}</div>
                <div class="slot-card-info">
                    ${slot.limit > 0 ? `Лимит: ${slot.limit}, Занято: ${slot.booked || 0}` : 'Без лимита'}
                </div>
            </div>
        `;
    }).join('');
}

function showAddSlotModal() {
    if (!adminState.currentDirectionId) return;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('slotDate').min = tomorrow.toISOString().split('T')[0];
    document.getElementById('slotDate').value = '';
    document.getElementById('slotLimit').value = '0';
    
    document.getElementById('slotModal').classList.remove('hidden');
}

function closeSlotModal() {
    document.getElementById('slotModal').classList.add('hidden');
}

async function handleSlotSave(e) {
    e.preventDefault();
    
    const data = {
        directionId: adminState.currentDirectionId,
        date: document.getElementById('slotDate').value,
        limit: parseInt(document.getElementById('slotLimit').value) || 0
    };
    
    try {
        await fetchWithAuth(`${API_URL}/admin/slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Дата добавлена', 'success');
        closeSlotModal();
        await loadSlotsForDirection(adminState.currentDirectionId);
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

async function deleteSlot(date) {
    if (!confirm('Удалить дату?')) return;
    
    try {
        await fetchWithAuth(`${API_URL}/admin/slots/${adminState.currentDirectionId}/${date}`, {
            method: 'DELETE'
        });
        showToast('Удалено', 'success');
        await loadSlotsForDirection(adminState.currentDirectionId);
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

// ==================== НАСТРОЙКИ ====================

async function loadSettings() {
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/settings`);
        adminState.settings = await res.json();
        
        const form = document.getElementById('settingsForm');
        form.warehouseAddress.value = adminState.settings.warehouseAddress || '';
        form.workHours.value = adminState.settings.workHours || '';
        form.telegramBotToken.value = adminState.settings.telegramBotToken || '';
        form.telegramChatId.value = adminState.settings.telegramChatId || '';
        form.adminPassword.value = '';
    } catch (e) {}
}

async function handleSettingsSave(e) {
    e.preventDefault();
    
    const form = e.target;
    const data = {
        warehouseAddress: form.warehouseAddress.value.trim(),
        workHours: form.workHours.value.trim(),
        telegramBotToken: form.telegramBotToken.value.trim(),
        telegramChatId: form.telegramChatId.value.trim()
    };
    
    // Пароль только если введён
    if (form.adminPassword.value.trim()) {
        data.adminPassword = form.adminPassword.value.trim();
    }
    
    try {
        await fetchWithAuth(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Настройки сохранены', 'success');
        form.adminPassword.value = '';
    } catch (e) {
        showToast('Ошибка', 'error');
    }
}

// ==================== УТИЛИТЫ ====================

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}