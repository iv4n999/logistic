// frontend/js/app.js - ПОЛНЫЙ НОВЫЙ КОД

const API_URL = '/api';

// Состояние
const state = {
    directions: [],
    slots: {},
    settings: {},
    selected: {
        direction: null,
        date: null,
        deliveryMethod: null,
        cargoType: null,
        quantity: 1
    }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadDirections();
    initEventListeners();
});

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        state.settings = await res.json();
        
        document.getElementById('warehouseAddress').textContent = 
            state.settings.warehouseAddress || 'Адрес не указан';
        document.getElementById('warehouseHours').textContent = 
            state.settings.workHours || '';
    } catch (e) {
        console.error('Ошибка загрузки настроек:', e);
    }
}

async function loadDirections() {
    try {
        const res = await fetch(`${API_URL}/directions`);
        state.directions = await res.json();
        renderDirections();
    } catch (e) {
        console.error('Ошибка загрузки направлений:', e);
    }
}

async function loadSlots(directionId) {
    try {
        const res = await fetch(`${API_URL}/slots/${directionId}`);
        const slots = await res.json();
        state.slots[directionId] = slots;
        renderDates(slots);
    } catch (e) {
        console.error('Ошибка загрузки слотов:', e);
    }
}

// ==================== РЕНДЕР ====================

function renderDirections() {
    const container = document.getElementById('directionsContainer');
    const noDirections = document.getElementById('noDirections');
    
    const activeDirections = state.directions.filter(d => d.active);
    
    if (activeDirections.length === 0) {
        container.classList.add('hidden');
        noDirections.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    noDirections.classList.add('hidden');
    
    container.innerHTML = activeDirections.map(dir => `
        <label class="direction-item">
            <input type="radio" name="direction" value="${dir.id}" 
                   data-name="${dir.name}" data-code="${dir.code}">
            <div class="direction-item-content">
                <span class="direction-item-name">${dir.name}</span>
                <span class="direction-item-code">${dir.code}</span>
            </div>
        </label>
    `).join('');
}

function renderDates(slots) {
    const container = document.getElementById('datesContainer');
    
    // Фильтруем только будущие даты
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureSlots = slots.filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= today;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (futureSlots.length === 0) {
        container.innerHTML = '<p class="hint-text">Нет доступных дат для этого направления</p>';
        return;
    }
    
    container.innerHTML = futureSlots.map(slot => {
        const date = new Date(slot.date);
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        
        const isAvailable = slot.limit === 0 || slot.booked < slot.limit;
        const slotsText = slot.limit > 0 
            ? `${slot.limit - slot.booked} из ${slot.limit}` 
            : 'Без лимита';
        
        return `
            <label class="date-item">
                <input type="radio" name="deliveryDate" value="${slot.date}" 
                       ${!isAvailable ? 'disabled' : ''}>
                <div class="date-item-content">
                    <div class="date-item-day">${dayName}</div>
                    <div class="date-item-date">${dateStr}</div>
                    <div class="date-item-slots">${slotsText}</div>
                </div>
            </label>
        `;
    }).join('');
}

// ==================== ОБРАБОТЧИКИ ====================

function initEventListeners() {
    // Выбор направления
    document.getElementById('directionsContainer').addEventListener('change', async (e) => {
        if (e.target.name === 'direction') {
            state.selected.direction = {
                id: parseInt(e.target.value),
                name: e.target.dataset.name,
                code: e.target.dataset.code
            };
            state.selected.date = null;
            await loadSlots(state.selected.direction.id);
            updateSummary();
        }
    });
    
    // Выбор даты
    document.getElementById('datesContainer').addEventListener('change', (e) => {
        if (e.target.name === 'deliveryDate') {
            state.selected.date = e.target.value;
            updatePickupDateLimits();
            updateSummary();
        }
    });
    
    // Способ доставки
    document.querySelectorAll('input[name="deliveryMethod"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.selected.deliveryMethod = e.target.value;
            toggleDeliveryMethodSections();
            updateSummary();
        });
    });
    
    // Дата забора
    document.getElementById('pickupDate').addEventListener('change', (e) => {
        state.selected.pickupDate = e.target.value;
        updateSummary();
    });
    
    // Тип груза
    document.querySelectorAll('input[name="cargoType"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.selected.cargoType = e.target.value;
            updateSummary();
        });
    });
    
    // Количество
    document.getElementById('quantity').addEventListener('input', (e) => {
        state.selected.quantity = Math.max(1, parseInt(e.target.value) || 1);
        updateSummary();
    });
    
    document.getElementById('quantityMinus').addEventListener('click', () => {
        const input = document.getElementById('quantity');
        const val = Math.max(1, parseInt(input.value) - 1);
        input.value = val;
        state.selected.quantity = val;
        updateSummary();
    });
    
    document.getElementById('quantityPlus').addEventListener('click', () => {
        const input = document.getElementById('quantity');
        const val = parseInt(input.value) + 1;
        input.value = val;
        state.selected.quantity = val;
        updateSummary();
    });
    
    // Контакты
    ['contactName', 'contactPhone', 'contactTelegram', 'pickupAddress', 'comment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateSummary);
    });
    
    // Отправка формы
    document.getElementById('orderForm').addEventListener('submit', handleSubmit);
}

function toggleDeliveryMethodSections() {
    const pickupDateSection = document.getElementById('pickupDateSection');
    const pickupAddressSection = document.getElementById('pickupAddressSection');
    const ourAddressSection = document.getElementById('ourAddressSection');
    const pickupDateLabel = document.getElementById('pickupDateLabel');
    
    pickupDateSection.classList.remove('hidden');
    
    if (state.selected.deliveryMethod === 'pickup') {
        pickupAddressSection.classList.remove('hidden');
        ourAddressSection.classList.add('hidden');
        pickupDateLabel.textContent = 'Дата забора груза';
        document.getElementById('pickupAddress').required = true;
    } else {
        pickupAddressSection.classList.add('hidden');
        ourAddressSection.classList.remove('hidden');
        pickupDateLabel.textContent = 'Дата привоза груза';
        document.getElementById('pickupAddress').required = false;
    }
}

function updatePickupDateLimits() {
    if (!state.selected.date) return;
    
    const deliveryDate = new Date(state.selected.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Максимум — за день до поставки
    const maxDate = new Date(deliveryDate);
    maxDate.setDate(maxDate.getDate() - 1);
    
    const pickupInput = document.getElementById('pickupDate');
    pickupInput.min = formatDateInput(today);
    pickupInput.max = formatDateInput(maxDate);
    
    // Сбрасываем если не подходит
    if (pickupInput.value) {
        const current = new Date(pickupInput.value);
        if (current > maxDate || current < today) {
            pickupInput.value = '';
            state.selected.pickupDate = null;
        }
    }
}

function formatDateInput(date) {
    return date.toISOString().split('T')[0];
}

function updateSummary() {
    const summary = document.getElementById('orderSummary');
    const submitBtn = document.getElementById('submitBtn');
    
    const contactName = document.getElementById('contactName').value.trim();
    const contactPhone = document.getElementById('contactPhone').value.trim();
    const pickupAddress = document.getElementById('pickupAddress').value.trim();
    const pickupDate = document.getElementById('pickupDate').value;
    
    // Проверка заполненности
    const isComplete = 
        state.selected.direction &&
        state.selected.date &&
        state.selected.deliveryMethod &&
        state.selected.cargoType &&
        state.selected.quantity > 0 &&
        contactName &&
        contactPhone &&
        pickupDate &&
        (state.selected.deliveryMethod === 'dropoff' || pickupAddress);
    
    submitBtn.disabled = !isComplete;
    
    // Рендер итогов
    const cargoNames = {
        boxes: 'Короба',
        pallets: 'Палеты',
        mono_pallets: 'Моно-палеты'
    };
    
    const methodNames = {
        pickup: 'Заберём сами',
        dropoff: 'Привезёт клиент'
    };
    
    let html = '';
    
    if (state.selected.direction) {
        html += `<div class="summary-row">
            <span class="summary-label">Направление</span>
            <span class="summary-value">${state.selected.direction.name}</span>
        </div>`;
    }
    
    if (state.selected.date) {
        html += `<div class="summary-row">
            <span class="summary-label">Дата поставки</span>
            <span class="summary-value">${formatDisplayDate(state.selected.date)}</span>
        </div>`;
    }
    
    if (state.selected.deliveryMethod) {
        html += `<div class="summary-row">
            <span class="summary-label">Доставка</span>
            <span class="summary-value">${methodNames[state.selected.deliveryMethod]}</span>
        </div>`;
    }
    
    if (state.selected.cargoType) {
        html += `<div class="summary-row">
            <span class="summary-label">Груз</span>
            <span class="summary-value">${cargoNames[state.selected.cargoType]} × ${state.selected.quantity}</span>
        </div>`;
    }
    
    summary.innerHTML = html || '<p class="summary-placeholder">Заполните форму выше</p>';
}

function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// ==================== ОТПРАВКА ====================

async function handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Отправка...</span>';
    
    const formData = {
        direction: state.selected.direction,
        deliveryDate: state.selected.date,
        pickupDate: document.getElementById('pickupDate').value,
        deliveryMethod: state.selected.deliveryMethod,
        pickupAddress: state.selected.deliveryMethod === 'pickup' 
            ? document.getElementById('pickupAddress').value.trim() 
            : null,
        cargoType: state.selected.cargoType,
        quantity: state.selected.quantity,
        contact: {
            name: document.getElementById('contactName').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            telegram: document.getElementById('contactTelegram').value.trim()
        },
        comment: document.getElementById('comment').value.trim()
    };
    
    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('orderNumber').textContent = result.orderNumber;
            document.getElementById('successModal').classList.remove('hidden');
        } else {
            alert('Ошибка: ' + (result.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при отправке заявки');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <span>Отправить заявку</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;
    }
}