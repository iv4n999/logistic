// backend/services/database.js
// Простая JSON-база данных (можно заменить на MongoDB/PostgreSQL)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');

// Инициализация файлов
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultSettings = {
    warehouseAddress: 'г. Москва, ул. Складская, д. 15, стр. 2',
    minDaysBeforeDelivery: 1,
    workHours: 'Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00',
    telegramBotToken: '',
    telegramChatId: '',
    vehicleCapacity: 100 // процент
};

const defaultDirections = [
    { id: 1, name: 'Москва (Коледино)', code: 'MSK-K', active: true },
    { id: 2, name: 'Москва (Электросталь)', code: 'MSK-E', active: true },
    { id: 3, name: 'Санкт-Петербург', code: 'SPB', active: true },
    { id: 4, name: 'Казань', code: 'KZN', active: true },
    { id: 5, name: 'Екатеринбург', code: 'EKB', active: true },
    { id: 6, name: 'Краснодар', code: 'KRD', active: true }
];

function initFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
}

initFile(ORDERS_FILE, []);
initFile(SETTINGS_FILE, defaultSettings);
initFile(DIRECTIONS_FILE, defaultDirections);

const db = {
    // Заявки
    getOrders() {
        return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    },
    
    saveOrder(order) {
        const orders = this.getOrders();
        orders.push(order);
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        return order;
    },
    
    updateOrder(orderNumber, updates) {
        const orders = this.getOrders();
        const index = orders.findIndex(o => o.orderNumber === orderNumber);
        if (index !== -1) {
            orders[index] = { ...orders[index], ...updates };
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
            return orders[index];
        }
        return null;
    },
    
    // Настройки
    getSettings() {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    },
    
    updateSettings(updates) {
        const settings = { ...this.getSettings(), ...updates };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return settings;
    },
    
    // Направления
    getDirections() {
        return JSON.parse(fs.readFileSync(DIRECTIONS_FILE, 'utf8'));
    },
    
    saveDirection(direction) {
        const directions = this.getDirections();
        if (direction.id) {
            const index = directions.findIndex(d => d.id === direction.id);
            if (index !== -1) {
                directions[index] = direction;
            }
        } else {
            direction.id = Math.max(...directions.map(d => d.id), 0) + 1;
            directions.push(direction);
        }
        fs.writeFileSync(DIRECTIONS_FILE, JSON.stringify(directions, null, 2));
        return direction;
    },
    
    deleteDirection(id) {
        const directions = this.getDirections().filter(d => d.id !== id);
        fs.writeFileSync(DIRECTIONS_FILE, JSON.stringify(directions, null, 2));
    },
    
    // Статистика загрузки машин
    getVehicleLoadForDate(date) {
        const orders = this.getOrders().filter(o => 
            o.deliveryDate === date && 
            o.status !== 'cancelled'
        );
        
        // Примерный расчёт загрузки
        let totalUnits = 0;
        orders.forEach(order => {
            switch (order.cargoType) {
                case 'boxes':
                    totalUnits += order.quantity * 0.5; // 1 короб = 0.5 единицы
                    break;
                case 'pallets':
                    totalUnits += order.quantity * 10; // 1 палета = 10 единиц
                    break;
                case 'mono_pallets':
                    totalUnits += order.quantity * 15; // 1 моно-палета = 15 единиц
                    break;
            }
        });
        
        const settings = this.getSettings();
        const capacity = settings.vehicleCapacity || 100;
        
        return {
            date,
            orders: orders.length,
            totalUnits,
            capacity,
            loadPercentage: Math.min(100, Math.round((totalUnits / capacity) * 100))
        };
    }
};

module.exports = { db };
