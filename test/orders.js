// backend/routes/orders.js - ПОЛНЫЙ КОД С ЦЕНАМИ
const express = require('express');
const router = express.Router();
const { sendTelegramNotification } = require('../services/telegram');
const { db } = require('../services/database');

// Получить направления (активные)
router.get('/directions', (req, res) => {
    const directions = db.getDirections().filter(d => d.active);
    res.json(directions);
});

// Получить настройки (публичные)
router.get('/settings', (req, res) => {
    const settings = db.getSettings();
    res.json({
        warehouseAddress: settings.warehouseAddress,
        workHours: settings.workHours
    });
});

// Получить слоты для направления
router.get('/slots/:directionId', (req, res) => {
    const slots = db.getSlots(parseInt(req.params.directionId));
    res.json(slots);
});

// Получить цены (публичные)
router.get('/prices', (req, res) => {
    const prices = db.getPrices();
    res.json(prices);
});

// Расчёт стоимости
router.post('/calculate', (req, res) => {
    const result = db.calculatePrice(req.body);
    res.json(result);
});

// Создать заявку
router.post('/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Проверяем доступность слота
        const directionId = orderData.direction?.id;
        const date = orderData.deliveryDate;
        
        if (directionId && date) {
            const slots = db.getSlots(directionId);
            const slot = slots.find(s => s.date === date);
            
            if (!slot) {
                return res.status(400).json({
                    success: false,
                    message: 'Эта дата недоступна для выбранного направления'
                });
            }
            
            if (slot.limit > 0 && slot.booked >= slot.limit) {
                return res.status(400).json({
                    success: false,
                    message: 'На эту дату больше нет свободных мест'
                });
            }
        }
        
        // Расчёт цены на сервере (для надёжности)
        const priceResult = db.calculatePrice(orderData);
        
        // Генерируем номер заявки
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        
        const order = {
            orderNumber,
            ...orderData,
            price: priceResult,
            status: 'new',
            createdAt: new Date().toISOString()
        };
        
        db.saveOrder(order);
        
        // Отправляем в Telegram
        await sendTelegramNotification(order);
        
        res.json({
            success: true,
            orderNumber,
            price: priceResult,
            message: 'Заявка успешно создана'
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при создании заявки'
        });
    }
});

// Отслеживание заявки
router.post('/track', (req, res) => {
    const { orderNumber, phone } = req.body;
    
    const order = db.getOrder(orderNumber);
    
    if (!order) {
        return res.status(404).json({ error: 'Заявка не найдена' });
    }
    
    // Проверяем телефон (последние 4 цифры)
    const orderPhone = order.contact?.phone?.replace(/\D/g, '').slice(-4);
    const inputPhone = phone?.replace(/\D/g, '').slice(-4);
    
    if (orderPhone !== inputPhone) {
        return res.status(403).json({ error: 'Неверный телефон' });
    }
    
    // Возвращаем данные заявки (без лишнего)
    res.json({
        orderNumber: order.orderNumber,
        status: order.status,
        direction: order.direction?.name,
        deliveryDate: order.deliveryDate,
        cargoType: order.cargoType,
        quantity: order.quantity,
        price: order.price,
        createdAt: order.createdAt
    });
});

module.exports = router;
