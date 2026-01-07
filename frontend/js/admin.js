// frontend/js/admin.js

const API_URL = 'http://localhost:3000/api';

// Состояние админ-панели
const adminState = {
    directions: [],
    orders: [],
    settings: {},
    currentOrder: null,
    activeSection: 'directions'
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    await loadDirections();
    await loadSettings();
    await loadOrders();
    initEventListeners();
});

// Навигация между секциями
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.admin-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // Активный пункт меню
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Показываем нужную секцию
            sections.forEach(section => {
                section.classList.toggle('hidden', section.id !== targetId);
            });
            
            adminState.activeSection = targetId;
            
            // Обновляем данные при переключении
            if (targetId === 'orders') {
                loadOrders();
            } else if (targetId === 'vehicle') {
                loadVehicleStats();
            }
        });
    });
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Форма настроек
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSave);
    
    // Форма направления
    document.getElementById('directionForm').addEventListener('submit', handleDirectionSave);
    
    // Фильтры заявок
    document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
    document.getElementById('orderDateFilter').addEventListener('change', loadOrders);
    
    // Дата для загрузки машин
    document.getElementById('vehicleDate').addEventListener('change', loadVehicleStats);
    
    // Установить сегодняшнюю дату по умолчанию
    document.getElementById('vehicleDate').value = new Date().toISOString().split('T')[0];
}

// ==================== НАПРАВЛЕНИЯ ====================

async function loadDirections() {
    try {
        const response = await fetch(`${API_URL}/admin/directions`);
        adminState.directions = await response.json();
        renderDirectionsTable();
    } catch (error) {
        console.error('Ошибка загрузки направлений:', error);
        showNotification('Ошибка загрузки направлений', 'error');
    }
}

function renderDirectionsTable() {
    const tbody = document.getElementById('directionsTable');
    
    if (adminState.directions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">Направления не добавлены</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = adminState.directions.map(direction => `
        <tr data-id="${direction.id}">
            <td><strong>${direction.name}</strong></td>
            <td><code>${direction.code}</code></td>
            <td>
                <span class="status-badge ${direction.active ? 'status-confirmed' : 'status-cancelled'}">
                    ${direction.active ? 'Активно' : 'Неактивно'}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn btn-small btn-secondary" onclick="editDirection(${direction.id})">
                    ✏️ Редактировать
                </button>
                <button class="btn btn-small btn-danger" onclick="deleteDirection(${direction.id})">
                    🗑️ Удалить
                </button>
            </td>
        </tr>
    `).join('');
}

function showAddDirectionModal() {
    document.getElementById('directionModalTitle').textContent = 'Добавить направление';
    document.getElementById('directionId').value = '';
    document.getElementById('directionName').value = '';
    document.getElementById('directionCode').value = '';
    document.getElementById('directionActive').checked = true;
    document.getElementById('directionModal').classList.remove('hidden');
}

function editDirection(id) {
    const direction = adminState.directions.find(d => d.id === id);
    if (!direction) return;
    
    document.getElementById('directionModalTitle').textContent = 'Редактировать направление';
    document.getElementById('directionId').value = direction.id;
    document.getElementById('directionName').value = direction.name;
    document.getElementById('directionCode').value = direction.code;
    document.getElementById('directionActive').checked = direction.active;
    document.getElementById('directionModal').classList.remove('hidden');
}

function closeDirectionModal() {
    document.getElementById('directionModal').classList.add('hidden');
}

async function handleDirectionSave(e) {
    e.preventDefault();
    
    const directionData = {
        name: document.getElementById('directionName').value.trim(),
        code: document.getElementById('directionCode').value.trim().toUpperCase(),
        active: document.getElementById('directionActive').checked
    };
    
    const id = document.getElementById('directionId').value;
    if (id) {
        directionData.id = parseInt(id);
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/directions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(directionData)
        });
        
        if (response.ok) {
            showNotification('Направление сохранено', 'success');
            closeDirectionModal();
            await loadDirections();
        } else {
            throw new Error('Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка сохранения направления:', error);
        showNotification('Ошибка сохранения направления', 'error');
    }
}

async function deleteDirection(id) {
    const direction = adminState.directions.find(d => d.id === id);
    if (!confirm(`Удалить направление "${direction.name}"?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/directions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Направление удалено', 'success');
            await loadDirections();
        } else {
            throw new Error('Ошибка удаления');
        }
    } catch (error) {
        console.error('Ошибка удаления направления:', error);
        showNotification('Ошибка удаления направления', 'error');
    }
}

// ==================== НАСТРОЙКИ ====================

async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/admin/settings`);
        adminState.settings = await response.json();
        populateSettingsForm();
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

function populateSettingsForm() {
    const form = document.getElementById('settingsForm');
    const settings = adminState.settings;
    
    form.querySelector('[name="warehouseAddress"]').value = settings.warehouseAddress || '';
    form.querySelector('[name="minDaysBeforeDelivery"]').value = settings.minDaysBeforeDelivery || 1;
    form.querySelector('[name="telegramBotToken"]').value = settings.telegramBotToken || '';
    form.querySelector('[name="telegramChatId"]').value = settings.telegramChatId || '';
    form.querySelector('[name="workHours"]').value = settings.workHours || '';
}

async function handleSettingsSave(e) {
    e.preventDefault();
    
    const form = e.target;
    const settingsData = {
        warehouseAddress: form.querySelector('[name="warehouseAddress"]').value.trim(),
        minDaysBeforeDelivery: parseInt(form.querySelector('[name="minDaysBeforeDelivery"]').value) || 1,
        telegramBotToken: form.querySelector('[name="telegramBotToken"]').value.trim(),
        telegramChatId: form.querySelector('[name="telegramChatId"]').value.trim(),
        workHours: form.querySelector('[name="workHours"]').value.trim()
    };
    
    try {
        const response = await fetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsData)
        });
        
        if (response.ok) {
            adminState.settings = await response.json();
            showNotification('Настройки сохранены', 'success');
        } else {
            throw new Error('Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showNotification('Ошибка сохранения настроек', 'error');
    }
}

// ==================== ЗАЯВКИ ====================

async function loadOrders() {
    try {
        const status = document.getElementById('orderStatusFilter').value;
        const date = document.getElementById('orderDateFilter').value;
        
        let url = `${API_URL}/admin/orders?`;
        if (status) url += `status=${status}&`;
        if (date) url += `date=${date}&`;
        
        const response = await fetch(url);
        adminState.orders = await response.json();
        renderOrdersTable();
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        showNotification('Ошибка загрузки заявок', 'error');
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTable');
    
    if (adminState.orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">Заявки не найдены</td>
            </tr>
        `;
        return;
    }
    
    const cargoNames = {
        boxes: '📦 Короба',
        pallets: '🏗️ Палеты',
        mono_pallets: '📐 Моно-палеты'
    };
    
    const statusNames = {
        new: 'Новая',
        confirmed: 'Подтверждена',
        in_progress: 'В работе',
        completed: 'Завершена',
        cancelled: 'Отменена'
    };
    
    tbody.innerHTML = adminState.orders.map(order => `
        <tr data-order="${order.orderNumber}">
            <td><strong>${order.orderNumber}</strong></td>
            <td>
                <div>${formatDisplayDate(order.deliveryDate)}</div>
                <small class="text-muted">${formatDisplayDate(order.createdAt, true)}</small>
            </td>
            <td>${order.direction?.name || '—'}</td>
            <td>
                <div>${order.contact?.name || '—'}</div>
                <small class="text-muted">${order.contact?.phone || ''}</small>
            </td>
            <td>${cargoNames[order.cargoType] || order.cargoType} × ${order.quantity}</td>
            <td>
                <span class="status-badge status-${order.status}">
                    ${statusNames[order.status] || order.status}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn btn-small btn-primary" onclick="openOrderModal('${order.orderNumber}')">
                    👁️ Подробнее
                </button>
            </td>
        </tr>
    `).join('');
}

function openOrderModal(orderNumber) {
    const order = adminState.orders.find(o => o.orderNumber === orderNumber);
    if (!order) return;
    
    adminState.currentOrder = order;
    
    document.getElementById('orderModalNumber').textContent = order.orderNumber;
    document.getElementById('orderStatusSelect').value = order.status;
    
    const cargoNames = {
        boxes: '📦 Короба',
        pallets: '🏗️ Палеты',
        mono_pallets: '📐 Моно-палеты'
    };
    
    const deliveryMethodNames = {
        pickup: '🚛 Мы заберём',
        dropoff: '📍 Клиент привезёт'
    };
    
    const content = document.getElementById('orderModalContent');
    content.innerHTML = `
        <div class="order-details">
            <div class="detail-group">
                <h4>📍 Направление</h4>
                <p>${order.direction?.name || '—'} (${order.direction?.code || '—'})</p>
            </div>
            
            <div class="detail-row">
                <div class="detail-group">
                    <h4>📅 Дата поставки</h4>
                    <p>${formatDisplayDate(order.deliveryDate)}</p>
                </div>
                <div class="detail-group">
                    <h4>📅 Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}</h4>
                    <p>${formatDisplayDate(order.pickupDate)}</p>
                </div>
            </div>
            
            <div class="detail-group">
                <h4>🚚 Способ доставки</h4>
                <p>${deliveryMethodNames[order.deliveryMethod] || order.deliveryMethod}</p>
            </div>
            
            ${order.pickupAddress ? `
                <div class="detail-group">
                    <h4>📌 Адрес забора</h4>
                    <p>${order.pickupAddress}</p>
                </div>
            ` : ''}
            
            <div class="detail-group">
                <h4>📦 Груз</h4>
                <p>${cargoNames[order.cargoType] || order.cargoType} × ${order.quantity}</p>
            </div>
            
            <div class="detail-group contact-info">
                <h4>👤 Контактное лицо</h4>
                <p><strong>Имя:</strong> ${order.contact?.name || '—'}</p>
                <p><strong>Телефон:</strong> <a href="tel:${order.contact?.phone}">${order.contact?.phone || '—'}</a></p>
                ${order.contact?.telegram ? `
                    <p><strong>Telegram:</strong> <a href="https://t.me/${order.contact.telegram.replace('@', '')}" target="_blank">${order.contact.telegram}</a></p>
                ` : ''}
            </div>
            
            ${order.comment ? `
                <div class="detail-group">
                    <h4>💬 Комментарий</h4>
                    <p>${order.comment}</p>
                </div>
            ` : ''}
            
            <div class="detail-group">
                <h4>📋 Информация о заявке</h4>
                <p><strong>Создана:</strong> ${formatDisplayDate(order.createdAt, true)}</p>
                ${order.updatedAt ? `<p><strong>Обновлена:</strong> ${formatDisplayDate(order.updatedAt, true)}</p>` : ''}
            </div>
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
    const orderNumber = adminState.currentOrder.orderNumber;
    
    try {
        const response = await fetch(`${API_URL}/admin/orders/${orderNumber}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showNotification('Статус обновлён', 'success');
            await loadOrders();
            
            // Обновляем текущий заказ
            adminState.currentOrder.status = newStatus;
        } else {
            throw new Error('Ошибка обновления');
        }
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showNotification('Ошибка обновления статуса', 'error');
    }
}

async function sendToTelegram() {
    if (!adminState.currentOrder) return;
    
    const orderNumber = adminState.currentOrder.orderNumber;
    
    try {
        const response = await fetch(`${API_URL}/admin/orders/${orderNumber}/telegram`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('Отправлено в Telegram', 'success');
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Ошибка отправки');
        }
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
        showNotification('Ошибка отправки в Telegram', 'error');
    }
}

// ==================== ЗАГРУЗКА МАШИН ====================

async function loadVehicleStats() {
    const date = document.getElementById('vehicleDate').value;
    if (!date) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/vehicle-load?date=${date}`);
        const data = await response.json();
        renderVehicleStats(data);
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        showNotification('Ошибка загрузки статистики', 'error');
    }
}

function renderVehicleStats(data) {
    const statsContainer = document.getElementById('vehicleStats');
    const ordersContainer = document.getElementById('vehicleOrders');
    
    const loadClass = data.loadPercentage >= 80 ? 'warning' : 
                      data.loadPercentage >= 100 ? 'danger' : 'normal';
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="value">${data.orders}</div>
            <div class="label">Заявок на дату</div>
        </div>
        <div class="stat-card">
            <div class="value">${data.totalUnits}</div>
            <div class="label">Единиц груза</div>
        </div>
        <div class="stat-card">
            <div class="value">${data.capacity}</div>
            <div class="label">Вместимость</div>
        </div>
        <div class="stat-card ${loadClass}">
            <div class="value">${data.loadPercentage}%</div>
            <div class="label">Загрузка</div>
            <div class="progress-bar">
                <div class="fill" style="width: ${Math.min(data.loadPercentage, 100)}%"></div>
            </div>
        </div>
    `;
    
    // Загружаем заявки на эту дату
    loadOrdersForDate(data.date);
}

async function loadOrdersForDate(date) {
    try {
        const response = await fetch(`${API_URL}/admin/orders?date=${date}`);
        const orders = await response.json();
        
        const ordersContainer = document.getElementById('vehicleOrders');
        
        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p class="empty-state">Нет заявок на эту дату</p>';
            return;
        }
        
        const cargoNames = {
            boxes: '📦 Короба',
            pallets: '🏗️ Палеты',
            mono_pallets: '📐 Моно-палеты'
        };
        
        const statusNames = {
            new: 'Новая',
            confirmed: 'Подтверждена',
            in_progress: 'В работе',
            completed: 'Завершена',
            cancelled: 'Отменена'
        };
        
        ordersContainer.innerHTML = `
            <h3>Заявки на ${formatDisplayDate(date)}</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>№ Заявки</th>
                        <th>Клиент</th>
                        <th>Направление</th>
                        <th>Груз</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr class="${order.status === 'cancelled' ? 'cancelled-row' : ''}">
                            <td><strong>${order.orderNumber}</strong></td>
                            <td>
                                ${order.contact?.name || '—'}
                                <br><small>${order.contact?.phone || ''}</small>
                            </td>
                            <td>${order.direction?.name || '—'}</td>
                            <td>${cargoNames[order.cargoType] || order.cargoType} × ${order.quantity}</td>
                            <td>
                                <span class="status-badge status-${order.status}">
                                    ${statusNames[order.status] || order.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function formatDisplayDate(dateStr, includeTime = false) {
    if (!dateStr) return '—';
    
    const date = new Date(dateStr);
    
    const options = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('ru-RU', options);
}

function showNotification(message, type = 'info') {
    // Удаляем предыдущее уведомление
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Закрытие модальных окон по клику вне их
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

// Закрытие модальных окон по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }
});
