// backend/services/database.js - ПОЛНЫЙ ОБНОВЛЁННЫЙ КОД
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');
const SLOTS_FILE = path.join(DATA_DIR, 'slots.json');

// Создание папки data
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Дефолтные данные
const defaultSettings = {
    warehouseAddress: 'г. Москва, ул. Складская, д. 15, стр. 2',
    workHours: 'Пн-Пт: 9:00 - 18:00',
    telegramBotToken: '',
    telegramChatId: ''
};

const defaultDirections = [
    { id: 1, name: 'Москва (Коледино)', code: 'MSK-K', active: true },
    { id: 2, name: 'Москва (Электросталь)', code: 'MSK-E', active: true },
    { id: 3, name: 'Санкт-Петербург', code: 'SPB', active: true },
    { id: 4, name: 'Казань', code: 'KZN', active: true }
];

const defaultSlots = {};

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
        
        // Увеличиваем счётчик занятых слотов
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
        
        if (order) {
            // Уменьшаем счётчик слотов
            if (order.direction?.id && order.deliveryDate) {
                this.decrementSlotBooked(order.direction.id, order.deliveryDate);
            }
        }
        
        const filtered = orders.filter(o => o.orderNumber !== orderNumber);
        writeJSON(ORDERS_FILE, filtered);
        return order;
    },
    
    deleteCompletedOrders() {
        const orders = this.getOrders();
        const toDelete = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
        
        // Уменьшаем счётчики слотов
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
        
        // Удаляем слоты для этого направления
        const slots = this.getAllSlots();
        delete slots[id];
        writeJSON(SLOTS_FILE, slots);
    },
    
    // ==================== СЛОТЫ (ДАТЫ ПОСТАВОК) ====================
    
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
        
        // Проверяем, есть ли уже такая дата
        const existing = allSlots[directionId].find(s => s.date === date);
        if (existing) {
            existing.limit = limit;
        } else {
            allSlots[directionId].push({
                date,
                limit,
                booked: 0
            });
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
    }
};

module.exports = { db };