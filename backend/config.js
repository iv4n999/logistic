// backend/config.js
require('dotenv').config();

const config = {
    // Сервер
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost'
    },
    
    // Telegram
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        // Можно добавить несколько чатов для уведомлений
        notificationChats: process.env.TELEGRAM_NOTIFICATION_CHATS 
            ? process.env.TELEGRAM_NOTIFICATION_CHATS.split(',') 
            : []
    },
    
    // Пути к данным
    paths: {
        dataDir: process.env.DATA_DIR || './data',
        ordersFile: 'orders.json',
        settingsFile: 'settings.json',
        directionsFile: 'directions.json'
    },
    
    // Настройки заявок по умолчанию
    orders: {
        minDaysBeforeDelivery: 1,
        maxDaysAhead: 30, // максимум дней вперёд для бронирования
        statuses: {
            NEW: 'new',
            CONFIRMED: 'confirmed',
            IN_PROGRESS: 'in_progress',
            COMPLETED: 'completed',
            CANCELLED: 'cancelled'
        }
    },
    
    // Типы грузов
    cargoTypes: {
        BOXES: {
            id: 'boxes',
            name: 'Короба',
            icon: '📦',
            unitWeight: 0.5 // вес в условных единицах для расчёта загрузки
        },
        PALLETS: {
            id: 'pallets',
            name: 'Палеты',
            icon: '🏗️',
            unitWeight: 10
        },
        MONO_PALLETS: {
            id: 'mono_pallets',
            name: 'Моно-палеты',
            icon: '📐',
            unitWeight: 15
        }
    },
    
    // Способы доставки
    deliveryMethods: {
        PICKUP: {
            id: 'pickup',
            name: 'Мы заберём',
            icon: '🚛'
        },
        DROPOFF: {
            id: 'dropoff',
            name: 'Привезут сами',
            icon: '📍'
        }
    },
    
    // Настройки машин/загрузки
    vehicle: {
        defaultCapacity: 100, // условные единицы
        warningThreshold: 80, // процент загрузки для предупреждения
        maxLoadPercentage: 100
    },
    
    // Настройки склада по умолчанию
    warehouse: {
        address: 'г. Москва, ул. Складская, д. 15, стр. 2',
        workHours: 'Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00',
        phone: '+7 (495) 123-45-67'
    },
    
    // Валидация
    validation: {
        phone: {
            pattern: /^[\+]?[0-9\s\-\(\)]{10,20}$/,
            message: 'Некорректный формат телефона'
        },
        telegram: {
            pattern: /^@?[a-zA-Z0-9_]{5,32}$/,
            message: 'Некорректный Telegram username'
        }
    },
    
    // CORS настройки
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
};

// Хелпер для получения статуса
config.getStatusName = (statusId) => {
    const statusNames = {
        new: 'Новая',
        confirmed: 'Подтверждена',
        in_progress: 'В работе',
        completed: 'Завершена',
        cancelled: 'Отменена'
    };
    return statusNames[statusId] || statusId;
};

// Хелпер для получения типа груза
config.getCargoType = (typeId) => {
    return Object.values(config.cargoTypes).find(t => t.id === typeId);
};

// Хелпер для получения способа доставки
config.getDeliveryMethod = (methodId) => {
    return Object.values(config.deliveryMethods).find(m => m.id === methodId);
};

module.exports = config;
