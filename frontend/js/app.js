// frontend/js/app.js
const API_URL = 'http://localhost:3000/api';

// Состояние формы
const state = {
    directions: [],
    settings: {},
    selectedDirection: null,
    deliveryDate: null,
    pickupDate: null,
    deliveryMethod: null,
    cargoType: null,
    quantity: 1
};

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await loadDirections();
    await loadSettings();
    initEventListeners();
    setMinDates();
});

// Загрузка направлений с сервера
async function loadDirections() {
    try {
        const response = await fetch(`${API_URL}/directions`);
        state.directions = await response.json();
        renderDirections();
    } catch (error) {
        console.error('Ошибка загрузки направлений:', error);
        // Fallback данные
        state.directions = [
            { id: 1, name: 'Москва', code: 'MSK', active: true },
            { id: 2, name: 'Санкт-Петербург', code: 'SPB', active: true },
            { id: 3, name: 'Казань', code: 'KZN', active: true },
            { id: 4, name: 'Екатеринбург', code: 'EKB', active: true }
        ];
        renderDirections();
    }
}

// Загрузка настроек
async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/settings`);
        state.settings = await response.json();
        document.getElementById('warehouseAddress').textContent = 
            state.settings.warehouseAddress || 'г. Москва, ул. Складская, д. 15';
    } catch (error) {
        state.settings = {
            warehouseAddress: 'г. Москва, ул. Складская, д. 15, стр. 2',
            minDaysBeforeDelivery: 1
        };
    }
}

// Рендер направлений
function renderDirections() {
    const container = document.getElementById('directionsContainer');
    container.innerHTML = state.directions
        .filter(d => d.active)
        .map(direction => `
            <label class="direction-card">
                <input type="radio" name="direction" value="${direction.id}" 
                       data-name="${direction.name}" data-code="${direction.code}">
                <div class="card-content">
                    <div class="name">${direction.name}</div>
                    <div class="info">${direction.code}</div>
                </div>
            </label>
        `).join('');
}

// Установка минимальных дат
function setMinDates() {
    const today = new Date();
    const minDays = state.settings.minDaysBeforeDelivery || 1;
    
    // Минимальная дата поставки - завтра
    const minDeliveryDate = new Date(today);
    minDeliveryDate.setDate(minDeliveryDate.getDate() + minDays + 1);
    
    document.getElementById('deliveryDate').min = formatDate(minDeliveryDate);
}

// Форматирование даты для input
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Обработчики событий
function initEventListeners() {
    const form = document.getElementById('orderForm');
    
    // Выбор направления
    document.getElementById('directionsContainer').addEventListener('change', (e) => {
        if (e.target.name === 'direction') {
            state.selectedDirection = {
                id: e.target.value,
                name: e.target.dataset.name,
                code: e.target.dataset.code
            };
            updateSummary();
        }
    });
    
    // Выбор даты поставки
    document.getElementById('deliveryDate').addEventListener('change', (e) => {
        state.deliveryDate = e.target.value;
        updatePickupDateLimits();
        updateSummary();
    });
    
    // Выбор способа доставки
    document.querySelectorAll('input[name="deliveryMethod"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.deliveryMethod = e.target.value;
            toggleDeliveryMethodSections();
            updateSummary();
        });
    });
    
    // Дата забора
    document.getElementById('pickupDate').addEventListener('change', (e) => {
        state.pickupDate = e.target.value;
        updateSummary();
    });
    
    // Тип груза
    document.querySelectorAll('input[name="cargoType"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.cargoType = e.target.value;
            updateQuantityUnit();
            updateSummary();
        });
    });
    
    // Количество
    document.getElementById('quantity').addEventListener('input', (e) => {
        state.quantity = parseInt(e.target.value) || 1;
        updateSummary();
    });
    
    // Контактные поля
    ['contactName', 'contactPhone', 'contactTelegram', 'pickupAddress'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateSummary);
        }
    });
    
    // Отправка формы
    form.addEventListener('submit', handleSubmit);
}

// Переключение секций способа доставки
function toggleDeliveryMethodSections() {
    const pickupDateSection = document.getElementById('pickupDateSection');
    const pickupAddressSection = document.getElementById('pickupAddressSection');
    const ourAddressSection = document.getElementById('ourAddressSection');
    
    // Показываем секцию даты
    pickupDateSection.classList.remove('hidden');
    
    if (state.deliveryMethod === 'pickup') {
        // Мы забираем
        pickupAddressSection.classList.remove('hidden');
        ourAddressSection.classList.add('hidden');
        document.getElementById('pickupAddress').required = true;
    } else {
        // Клиент привозит
        pickupAddressSection.classList.add('hidden');
        ourAddressSection.classList.remove('hidden');
        document.getElementById('pickupAddress').required = false;
    }
}

// Ограничения даты забора
function updatePickupDateLimits() {
    if (!state.deliveryDate) return;
    
    const deliveryDate = new Date(state.deliveryDate);
    const minDays = state.settings.minDaysBeforeDelivery || 1;
    
    // Максимальная дата забора - за день до поставки
    const maxPickupDate = new Date(deliveryDate);
    maxPickupDate.setDate(maxPickupDate.getDate() - minDays);
    
    // Минимальная дата - сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pickupDateInput = document.getElementById('pickupDate');
    pickupDateInput.min = formatDate(today);
    pickupDateInput.max = formatDate(maxPickupDate);
    
    // Сбрасываем если текущая дата не подходит
    if (pickupDateInput.value) {
        const currentPickup = new Date(pickupDateInput.value);
        if (currentPickup > maxPickupDate || currentPickup < today) {
            pickupDateInput.value = '';
            state.pickupDate = null;
        }
    }
}

// Обновление единицы измерения
function updateQuantityUnit() {
    const unitSpan = document.getElementById('quantityUnit');
    const units = {
        boxes: 'коробов',
        pallets: 'палет',
        mono_pallets: 'моно-палет'
    };
    unitSpan.textContent = units[state.cargoType] || 'шт.';
}

// Обновление итогов
function updateSummary() {
    const summary = document.getElementById('orderSummary');
    const submitBtn = document.getElementById('submitBtn');
    
    const contactName = document.getElementById('contactName').value;
    const contactPhone = document.getElementById('contactPhone').value;
    const pickupAddress = document.getElementById('pickupAddress').value;
    
    // Проверяем заполненность
    const isComplete = state.selectedDirection && 
                       state.deliveryDate && 
                       state.deliveryMethod && 
                       state.cargoType && 
                       state.quantity > 0 &&
                       contactName && 
                       contactPhone &&
                       (state.deliveryMethod === 'dropoff' || pickupAddress) &&
                       state.pickupDate;
    
    submitBtn.disabled = !isComplete;
    
    // Формируем итоги
    const cargoNames = {
        boxes: 'Короба',
        pallets: 'Палеты',
        mono_pallets: 'Моно-палеты'
    };
    
    const methodNames = {
        pickup: 'Мы заберём',
        dropoff: 'Клиент привезёт'
    };
    
    let summaryHTML = '<div class="summary-rows">';
    
    if (state.selectedDirection) {
        summaryHTML += `
            <div class="summary-row">
                <span class="summary-label">Направление:</span>
                <span class="summary-value">${state.selectedDirection.name}</span>
            </div>`;
    }
    
    if (state.deliveryDate) {
        summaryHTML += `
            <div class="summary-row">
                <span class="summary-label">Дата поставки:</span>
                <span class="summary-value">${formatDisplayDate(state.deliveryDate)}</span>
            </div>`;
    }
    
    if (state.pickupDate) {
        const label = state.deliveryMethod === 'pickup' ? 'Дата забора:' : 'Дата привоза:';
        summaryHTML += `
            <div class="summary-row">
                <span class="summary-label">${label}</span>
                <span class="summary-value">${formatDisplayDate(state.pickupDate)}</span>
            </div>`;
    }
    
    if (state.deliveryMethod) {
        summaryHTML += `
            <div class="summary-row">
                <span class="summary-label">Способ:</span>
                <span class="summary-value">${methodNames[state.deliveryMethod]}</span>
            </div>`;
    }
    
    if (state.cargoType) {
        summaryHTML += `
            <div class="summary-row">
                <span class="summary-label">Груз:</span>
                <span class="summary-value">${cargoNames[state.cargoType]} × ${state.quantity}</span>
            </div>`;
    }
    
    summaryHTML += '</div>';
    summary.innerHTML = summaryHTML || '<p>Заполните форму для просмотра итогов</p>';
}

// Форматирование даты для отображения
function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Отправка формы
async function handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    
    const formData = {
        direction: state.selectedDirection,
        deliveryDate: state.deliveryDate,
        pickupDate: state.pickupDate,
        deliveryMethod: state.deliveryMethod,
        pickupAddress: state.deliveryMethod === 'pickup' 
            ? document.getElementById('pickupAddress').value 
            : null,
        cargoType: state.cargoType,
        quantity: state.quantity,
        contact: {
            name: document.getElementById('contactName').value,
            phone: document.getElementById('contactPhone').value,
            telegram: document.getElementById('contactTelegram').value
        },
        comment: document.getElementById('comment').value
    };
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('orderNumber').textContent = result.orderNumber;
            document.getElementById('successModal').classList.remove('hidden');
        } else {
            alert('Ошибка: ' + result.message);
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        alert('Произошла ошибка при отправке. Попробуйте позже.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
    }
}

// Закрытие модального окна
document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('successModal').classList.add('hidden');
});
