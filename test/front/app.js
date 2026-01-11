// frontend/js/app.js - ПОЛНЫЙ КОД С КАЛЬКУЛЯТОРОМ

const API_URL = '/api';

// Состояние
const state = {
    directions: [],
    slots: {},
    settings: {},
    prices: {},
    selected: {
        direction: null,
        date: null,
        deliveryMethod: null,
        pickupZone: null,
        cargoType: null,
        quantity: 1,
        isUrgent: false
    },
    calculatedPrice: null
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadPrices();
    await loadDirections();
    initEventListeners();
    initPhoneMask();
    initTelegramMask();
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

async function loadPrices() {
    try {
        const res = await fetch(`${API_URL}/prices`);
        state.prices = await res.json();
        
        // Показываем секцию срочности если включена
        if (state.prices.urgent?.enabled) {
            document.getElementById('urgentSection').classList.remove('hidden');
            document.getElementById('urgentLabel').textContent = 
                `+${state.prices.urgent.percent}% к стоимости`;
        }
        
        // Заполняем зоны забора
        renderPickupZones();
        
    } catch (e) {
        console.error('Ошибка загрузки цен:', e);
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

function renderPickupZones() {
    const select = document.getElementById('pickupZone');
    
    if (!state.prices.pickup?.zones) return;
    
    select.innerHTML = state.prices.pickup.zones.map((zone, index) => `
        <option value="${index}">${zone.name} — ${zone.price.toLocaleString('ru-RU')} ₽</option>
    `).join('');
}

function updateDirectionPrices() {
    if (!state.selected.direction) return;
    
    const dirPrices = state.prices.directions?.[state.selected.direction.id];
    
    if (dirPrices) {
        document.getElementById('priceBoxes').textContent = `${dirPrices.boxes} ₽/шт`;
        document.getElementById('pricePallets').textContent = `${dirPrices.pallets} ₽/шт`;
        document.getElementById('priceMonoPallets').textContent = `${dirPrices.mono_pallets} ₽/шт`;
    }
}

function updateDiscountHint() {
    const hint = document.getElementById('discountHint');
    const quantity = state.selected.quantity;
    
    if (!state.prices.discounts) {
        hint.classList.add('hidden');
        return;
    }
    
    // Находим следующую скидку
    const sortedDiscounts = [...state.prices.discounts].sort((a, b) => a.minQuantity - b.minQuantity);
    const nextDiscount = sortedDiscounts.find(d => d.minQuantity > quantity);
    const currentDiscount = sortedDiscounts.filter(d => d.minQuantity <= quantity).pop();
    
    let hintText = '';
    
    if (currentDiscount) {
        hintText = `✓ Скидка ${currentDiscount.percent}% применена`;
    }
    
    if (nextDiscount) {
        const need = nextDiscount.minQuantity - quantity;
        hintText += hintText ? ' · ' : '';
        hintText += `Ещё ${need} шт для скидки ${nextDiscount.percent}%`;
    }
    
    if (hintText) {
        hint.textContent = hintText;
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
}

// ==================== КАЛЬКУЛЯТОР ====================

async function calculatePrice() {
    if (!state.selected.direction || !state.selected.cargoType) {
        document.getElementById('calculatorBody').innerHTML = 
            '<p class="calculator-placeholder">Выберите направление и тип груза</p>';
        document.getElementById('calculatorTotal').classList.add('hidden');
        state.calculatedPrice = null;
        return;
    }
    
    const data = {
        direction: state.selected.direction,
        cargoType: state.selected.cargoType,
        quantity: state.selected.quantity,
        deliveryMethod: state.selected.deliveryMethod,
        pickupZone: state.selected.deliveryMethod === 'pickup' ? 
            parseInt(document.getElementById('pickupZone').value) : null,
        isUrgent: state.selected.isUrgent
    };
    
    try {
        const res = await fetch(`${API_URL}/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        state.calculatedPrice = result;
        
        renderCalculator(result);
        
    } catch (e) {
        console.error('Ошибка расчёта:', e);
    }
}

function renderCalculator(result) {
    const body = document.getElementById('calculatorBody');
    const totalEl = document.getElementById('calculatorTotal');
    const totalPrice = document.getElementById('totalPrice');
    
    if (!result || result.total === 0) {
        body.innerHTML = '<p class="calculator-placeholder">Выберите направление и тип груза</p>';
        totalEl.classList.add('hidden');
        return;
    }
    
    body.innerHTML = result.breakdown.map(item => `
        <div class="calculator-row ${item.value < 0 ? 'discount' : ''}">
            <span>${item.label}</span>
            <span>${item.value >= 0 ? '' : '−'}${Math.abs(item.value).toLocaleString('ru-RU')} ₽</span>
        </div>
    `).join('');
    
    totalPrice.textContent = result.total.toLocaleString('ru-RU') + ' ₽';
    totalEl.classList.remove('hidden');
}

// ==================== МАСКИ ВВОДА ====================

function initPhoneMask() {
    const phoneInput = document.getElementById('contactPhone');
    phoneInput.value = '+7 ';
    
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.startsWith('8')) value = '7' + value.slice(1);
        if (!value.startsWith('7')) value = '7' + value;
        
        value = value.slice(0, 11);
        
        let formatted = '+7';
        if (value.length > 1) formatted += ' (' + value.slice(1, 4);
        if (value.length > 4) formatted += ') ' + value.slice(4, 7);
        if (value.length > 7) formatted += '-' + value.slice(7, 9);
        if (value.length > 9) formatted += '-' + value.slice(9, 11);
        
        e.target.value = formatted;
        updateFormState();
    });
    
    phoneInput.addEventListener('keydown', (e) => {
        if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.selectionStart <= 3) {
            e.preventDefault();
        }
    });
    
    phoneInput.addEventListener('focus', (e) => {
        if (e.target.value === '+7 ' || e.target.value === '+7') {
            setTimeout(() => e.target.setSelectionRange(3, 3), 0);
        }
    });
}

function initTelegramMask() {
    const telegramInput = document.getElementById('contactTelegram');
    
    telegramInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/@/g, '').replace(/[^a-zA-Z0-9_]/g, '');
        e.target.value = value.length > 0 ? '@' + value : '';
        updateFormState();
    });
    
    telegramInput.addEventListener('focus', (e) => {
        if (e.target.value === '') e.target.value = '@';
    });
    
    telegramInput.addEventListener('blur', (e) => {
        if (e.target.value === '@') e.target.value = '';
    });
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
            updateDirectionPrices();
            calculatePrice();
            updateFormState();
        }
    });
    
    // Выбор даты
    document.getElementById('datesContainer').addEventListener('change', (e) => {
        if (e.target.name === 'deliveryDate') {
            state.selected.date = e.target.value;
            updatePickupDateLimits();
            updateFormState();
        }
    });
    
    // Способ доставки
    document.querySelectorAll('input[name="deliveryMethod"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.selected.deliveryMethod = e.target.value;
            toggleDeliveryMethodSections();
            calculatePrice();
            updateFormState();
        });
    });
    
    // Зона забора
    document.getElementById('pickupZone').addEventListener('change', () => {
        calculatePrice();
    });
    
    // Дата забора
    document.getElementById('pickupDate').addEventListener('change', (e) => {
        state.selected.pickupDate = e.target.value;
        updateFormState();
    });
    
    // Тип груза
    document.querySelectorAll('input[name="cargoType"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.selected.cargoType = e.target.value;
            calculatePrice();
            updateFormState();
        });
    });
    
    // Количество
    const quantityInput = document.getElementById('quantity');
    quantityInput.addEventListener('input', (e) => {
        state.selected.quantity = Math.max(1, parseInt(e.target.value) || 1);
        updateDiscountHint();
        calculatePrice();
        updateFormState();
    });
    
    document.getElementById('quantityMinus').addEventListener('click', () => {
        const val = Math.max(1, state.selected.quantity - 1);
        quantityInput.value = val;
        state.selected.quantity = val;
        updateDiscountHint();
        calculatePrice();
        updateFormState();
    });
    
    document.getElementById('quantityPlus').addEventListener('click', () => {
        const val = state.selected.quantity + 1;
        quantityInput.value = val;
        state.selected.quantity = val;
        updateDiscountHint();
        calculatePrice();
        updateFormState();
    });
    
    // Срочность
    document.getElementById('isUrgent').addEventListener('change', (e) => {
        state.selected.isUrgent = e.target.checked;
        calculatePrice();
    });
    
    // Контакты
    ['contactName', 'pickupAddress', 'comment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateFormState);
    });
    
    // Отправка формы
    document.getElementById('orderForm').addEventListener('submit', handleSubmit);
}

function toggleDeliveryMethodSections() {
    const pickupDateSection = document.getElementById('pickupDateSection');
    const pickupZoneSection = document.getElementById('pickupZoneSection');
    const pickupAddressSection = document.getElementById('pickupAddressSection');
    const ourAddressSection = document.getElementById('ourAddressSection');
    const pickupDateLabel = document.getElementById('pickupDateLabel');
    
    pickupDateSection.classList.remove('hidden');
    
    if (state.selected.deliveryMethod === 'pickup') {
        pickupZoneSection.classList.remove('hidden');
        pickupAddressSection.classList.remove('hidden');
        ourAddressSection.classList.add('hidden');
        pickupDateLabel.textContent = 'Дата забора груза';
        document.getElementById('pickupAddress').required = true;
    } else {
        pickupZoneSection.classList.add('hidden');
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
    
    const maxDate = new Date(deliveryDate);
    maxDate.setDate(maxDate.getDate() - 1);
    
    const pickupInput = document.getElementById('pickupDate');
    pickupInput.min = formatDateInput(today);
    pickupInput.max = formatDateInput(maxDate);
    
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

function updateFormState() {
    const submitBtn = document.getElementById('submitBtn');
    
    const contactName = document.getElementById('contactName').value.trim();
    const contactPhone = document.getElementById('contactPhone').value.trim();
    const pickupAddress = document.getElementById('pickupAddress').value.trim();
    const pickupDate = document.getElementById('pickupDate').value;
    
    const isPhoneComplete = contactPhone.length >= 18;
    
    const isComplete = 
        state.selected.direction &&
        state.selected.date &&
        state.selected.deliveryMethod &&
        state.selected.cargoType &&
        state.selected.quantity > 0 &&
        contactName &&
        isPhoneComplete &&
        pickupDate &&
        (state.selected.deliveryMethod === 'dropoff' || pickupAddress);
    
    submitBtn.disabled = !isComplete;
}

// ==================== ОТПРАВКА ====================

async function handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Отправка...</span>';
    
    const pickupZoneSelect = document.getElementById('pickupZone');
    const pickupZoneIndex = parseInt(pickupZoneSelect.value);
    const pickupZoneName = state.prices.pickup?.zones?.[pickupZoneIndex]?.name;
    
    const telegramValue = document.getElementById('contactTelegram').value.trim();
    
    const formData = {
        direction: state.selected.direction,
        deliveryDate: state.selected.date,
        pickupDate: document.getElementById('pickupDate').value,
        deliveryMethod: state.selected.deliveryMethod,
        pickupZone: state.selected.deliveryMethod === 'pickup' ? pickupZoneIndex : null,
        pickupZoneName: state.selected.deliveryMethod === 'pickup' ? pickupZoneName : null,
        pickupAddress: state.selected.deliveryMethod === 'pickup' 
            ? document.getElementById('pickupAddress').value.trim() 
            : null,
        cargoType: state.selected.cargoType,
        quantity: state.selected.quantity,
        isUrgent: state.selected.isUrgent,
        contact: {
            name: document.getElementById('contactName').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            telegram: telegramValue === '@' ? '' : telegramValue
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
            
            if (result.price?.total) {
                document.getElementById('orderPrice').textContent = 
                    `Стоимость: ${result.price.total.toLocaleString('ru-RU')} ₽`;
            }
            
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