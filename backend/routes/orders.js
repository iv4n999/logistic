// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const { sendTelegramNotification } = require('../services/telegram');
const { db } = require('../services/database');

// Получить направления
router.get('/directions', (req, res) => {
    const directions = db.getDirections();
    res.json(directions);
});

// Получить настройки
router.get('/settings', (req, res) => {
    const settings = db.getSettings();
    res.json({
        warehouseAddress: settings.warehouseAddress,
        minDaysBeforeDelivery: settings.minDaysBeforeDelivery,
        workHours: settings.workHours
    });
});

// Создать заявку
router.post('/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Генерируем номер заявки
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        
        // Сохраняем заявку
        const order = {
            orderNumber,
            ...orderData,
            status: 'new',
            createdAt: new Date().toISOString()
        };
        
        db.saveOrder(order);
        
        // Отправляем в Telegram
        await sendTelegramNotification(order);
        
        res.json({
            success: true,
            orderNumber,
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

module.exports = router;
