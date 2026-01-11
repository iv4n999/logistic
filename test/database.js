// backend/services/database.js - ПОЛНЫЙ КОД С ЦЕНАМИ
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');
const SLOTS_FILE = path.join(DATA_DIR, 'slots.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

// Создание папки data
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Дефолтные данные
const defaultSettings = {
    warehouseAddress: 'г. Москва, ул. Складская, д. 15, стр. 2',
    workHours: 'Пн-Пт: 9:00 - 18:00',
    telegramBotToken: '',
    telegramChatId: '',
    adminPassword: 'admin123'
};

const defaultDirections = [
    { id: 1, name: 'Москва (Коледино)', code: 'MSK-K', active: true },
    { id: 2, name: 'Москва (Электросталь)', code: 'MSK-E', active: true },
    { id: 3, name: 'Санкт-Петербург', code: 'SPB', active: true },
    { id: 4, name: 'Казань', code: 'KZN', active: true }
];

const defaultSlots = {};

const defaultPrices = {
    // Цены по направлениям (ID направления)
    directions: {
        1: { boxes: 50, pallets: 500, mono_pallets: 700 },
        2: { boxes: 55, pallets: 550, mono_pallets: 750 },
        3: { boxes: 80, pallets: 700, mono_pallets: 900 },
        4: { boxes: 100, pallets: 900, mono_pallets: 1100 }
    },
    // Забор груза
    pickup: {
        enabled: true,
        zones: [
            { name: 'В пределах МКАД', price: 1500 },
            { name: 'До 10 км от МКАД', price: 2000 },
            { name: 'До 30 км от МКАД', price: 2500 },
            { name: 'До 50 км от МКАД', price: 3500 },
            { name: 'Более 50 км', price: 5000 }
        ]
    },
    // Скидки за объём
    discounts: [
        { minQuantity: 50, percent: 5, label: 'от 50 шт — скидка 5%' },
        { minQuantity: 100, percent: 10, label: 'от 100 шт — скидка 10%' },
        { minQuantity: 200, percent: 15, label: 'от 200 шт — скидка 15%' },
        { minQuantity: 500, percent: 20, label: 'от 500 шт — скидка 20%' }
    ],
    // Срочность
    urgent: {
        enabled: true,
        percent: 50,
        label: 'Срочная доставка (+50%)'
    }
};

// Инициализация файлов
function initFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
}

initFile(ORDERS_FILE, []);
initFile(SETTINGS_FILE, defaultSettings);
initFile(DIRECTIONS_FILE, defaultDirections);
initFile(SLOTS_FILE, defaultSlots);
initFile(PRICES_FILE, defaultPrices);

// Хелпер чтения/записи
function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const db = {
    // ==================== ЗАЯВКИ ====================
    
    getOrders() {
        return readJSON(ORDERS_FILE);
    },
    
    getOrder(orderNumber) {
        return this.getOrders().find(o => o.orderNumber === orderNumber);
    },
    
    saveOrder(order) {
        const orders = this.getOrders();
        orders.push(order);
        writeJSON(ORDERS_FILE, orders);
        
        if (order.direction?.id && order.deliveryDate) {
            this.incrementSlotBooked(order.direction.id, order.deliveryDate);
        }
        
        return order;
    },
    
    updateOrder(orderNumber, updates) {
        const orders = this.getOrders();
        const index = orders.findIndex(o => o.orderNumber === orderNumber);
        if (index !== -1) {
            orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
            writeJSON(ORDERS_FILE, orders);
            return orders[index];
        }
        return null;
    },
    
    deleteOrder(orderNumber) {
        const orders = this.getOrders();
        const order = orders.find(o => o.orderNumber === orderNumber);
        
        if (order && order.direction?.id && order.deliveryDate) {
            this.decrementSlotBooked(order.direction.id, order.deliveryDate);
        }
        
        const filtered = orders.filter(o => o.orderNumber !== orderNumber);
        writeJSON(ORDERS_FILE, filtered);
        return order;
    },
    
    deleteCompletedOrders() {
        const orders = this.getOrders();
        const toDelete = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
        
        toDelete.forEach(order => {
            if (order.direction?.id && order.deliveryDate) {
                this.decrementSlotBooked(order.direction.id, order.deliveryDate);
            }
        });
        
        const remaining = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
        writeJSON(ORDERS_FILE, remaining);
        return toDelete.length;
    },
    
    // ==================== НАСТРОЙКИ ====================
    
    getSettings() {
        return readJSON(SETTINGS_FILE);
    },
    
    updateSettings(updates) {
        const settings = { ...this.getSettings(), ...updates };
        writeJSON(SETTINGS_FILE, settings);
        return settings;
    },
    
    // ==================== НАПРАВЛЕНИЯ ====================
    
    getDirections() {
        return readJSON(DIRECTIONS_FILE);
    },
    
    saveDirection(direction) {
        const directions = this.getDirections();
        
        if (direction.id) {
            const index = directions.findIndex(d => d.id === direction.id);
            if (index !== -1) {
                directions[index] = direction;
            } else {
                directions.push(direction);
            }
        } else {
            direction.id = Math.max(0, ...directions.map(d => d.id)) + 1;
            directions.push(direction);
        }
        
        writeJSON(DIRECTIONS_FILE, directions);
        return direction;
    },
    
    deleteDirection(id) {
        const directions = this.getDirections().filter(d => d.id !== id);
        writeJSON(DIRECTIONS_FILE, directions);
        
        const slots = this.getAllSlots();
        delete slots[id];
        writeJSON(SLOTS_FILE, slots);
        
        // Удаляем цены для этого направления
        const prices = this.getPrices();
        delete prices.directions[id];
        writeJSON(PRICES_FILE, prices);
    },
    
    // ==================== СЛОТЫ ====================
    
    getAllSlots() {
        return readJSON(SLOTS_FILE);
    },
    
    getSlots(directionId) {
        const allSlots = this.getAllSlots();
        return allSlots[directionId] || [];
    },
    
    addSlot(directionId, date, limit = 0) {
        const allSlots = this.getAllSlots();
        
        if (!allSlots[directionId]) {
            allSlots[directionId] = [];
        }
        
        const existing = allSlots[directionId].find(s => s.date === date);
        if (existing) {
            existing.limit = limit;
        } else {
            allSlots[directionId].push({ date, limit, booked: 0 });
        }
        
        writeJSON(SLOTS_FILE, allSlots);
        return allSlots[directionId];
    },
    
    deleteSlot(directionId, date) {
        const allSlots = this.getAllSlots();
        
        if (allSlots[directionId]) {
            allSlots[directionId] = allSlots[directionId].filter(s => s.date !== date);
            writeJSON(SLOTS_FILE, allSlots);
        }
    },
    
    incrementSlotBooked(directionId, date) {
        const allSlots = this.getAllSlots();
        
        if (allSlots[directionId]) {
            const slot = allSlots[directionId].find(s => s.date === date);
            if (slot) {
                slot.booked = (slot.booked || 0) + 1;
                writeJSON(SLOTS_FILE, allSlots);
            }
        }
    },
    
    decrementSlotBooked(directionId, date) {
        const allSlots = this.getAllSlots();
        
        if (allSlots[directionId]) {
            const slot = allSlots[directionId].find(s => s.date === date);
            if (slot && slot.booked > 0) {
                slot.booked--;
                writeJSON(SLOTS_FILE, allSlots);
            }
        }
    },
    
    // ==================== ЦЕНЫ ====================
    
    getPrices() {
        return readJSON(PRICES_FILE);
    },
    
    updatePrices(updates) {
        const prices = { ...this.getPrices(), ...updates };
        writeJSON(PRICES_FILE, prices);
        return prices;
    },
    
    setDirectionPrices(directionId, priceData) {
        const prices = this.getPrices();
        prices.directions[directionId] = priceData;
        writeJSON(PRICES_FILE, prices);
        return prices;
    },
    
    // Расчёт стоимости заказа
    calculatePrice(orderData) {
        const prices = this.getPrices();
        const { direction, cargoType, quantity, deliveryMethod, pickupZone, isUrgent } = orderData;
        
        let result = {
            base: 0,
            pickup: 0,
            discount: 0,
            discountPercent: 0,
            urgent: 0,
            urgentPercent: 0,
            total: 0,
            breakdown: []
        };
        
        // 1. Базовая цена
        const dirPrices = prices.directions[direction?.id];
        if (dirPrices && dirPrices[cargoType]) {
            result.base = dirPrices[cargoType] * quantity;
            result.breakdown.push({
                label: `${quantity} × ${dirPrices[cargoType]} ₽`,
                value: result.base
            });
        }
        
        // 2. Забор груза
        if (deliveryMethod === 'pickup' && pickupZone !== undefined && prices.pickup.enabled) {
            const zone = prices.pickup.zones[pickupZone];
            if (zone) {
                result.pickup = zone.price;
                result.breakdown.push({
                    label: `Забор: ${zone.name}`,
                    value: result.pickup
                });
            }
        }
        
        // 3. Скидка за объём
        for (const discount of prices.discounts.sort((a, b) => b.minQuantity - a.minQuantity)) {
            if (quantity >= discount.minQuantity) {
                result.discountPercent = discount.percent;
                result.discount = Math.round(result.base * discount.percent / 100);
                result.breakdown.push({
                    label: `Скидка ${discount.percent}%`,
                    value: -result.discount
                });
                break;
            }
        }
        
        // 4. Срочность
        if (isUrgent && prices.urgent.enabled) {
            result.urgentPercent = prices.urgent.percent;
            const baseAfterDiscount = result.base - result.discount;
            result.urgent = Math.round(baseAfterDiscount * prices.urgent.percent / 100);
            result.breakdown.push({
                label: `Срочность +${prices.urgent.percent}%`,
                value: result.urgent
            });
        }
        
        // Итого
        result.total = result.base + result.pickup - result.discount + result.urgent;
        
        return result;
    }
};

module.exports = { db };
