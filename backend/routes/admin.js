// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { db } = require('../services/database');
const { sendTelegramNotification } = require('../services/telegram');

// Направления
router.get('/directions', (req, res) => {
    res.json(db.getDirections());
});

router.post('/directions', (req, res) => {
    const direction = db.saveDirection(req.body);
    res.json(direction);
});

router.delete('/directions/:id', (req, res) => {
    db.deleteDirection(parseInt(req.params.id));
    res.json({ success: true });
});

// Настройки
router.get('/settings', (req, res) => {
    res.json(db.getSettings());
});

router.put('/settings', (req, res) => {
    const settings = db.updateSettings(req.body);
    res.json(settings);
});

// Заявки
router.get('/orders', (req, res) => {
    let orders = db.getOrders();
    
    // Фильтрация
    if (req.query.status) {
        orders = orders.filter(o => o.status === req.query.status);
    }
    if (req.query.date) {
        orders = orders.filter(o => o.deliveryDate === req.query.date);
    }
    
    // Сортировка по дате создания (новые первые)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(orders);
});

router.get('/orders/:orderNumber', (req, res) => {
    const orders = db.getOrders();
    const order = orders.find(o => o.orderNumber === req.params.orderNumber);
    if (order) {
        res.json(order);
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

router.put('/orders/:orderNumber/status', (req, res) => {
    const order = db.updateOrder(req.params.orderNumber, {
        status: req.body.status,
        updatedAt: new Date().toISOString()
    });
    if (order) {
        res.json(order);
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

// Повторная отправка в Telegram
router.post('/orders/:orderNumber/telegram', async (req, res) => {
    const orders = db.getOrders();
    const order = orders.find(o => o.orderNumber === req.params.orderNumber);
    if (order) {
        await sendTelegramNotification(order);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

// Загрузка машин
router.get('/vehicle-load', (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const load = db.getVehicleLoadForDate(date);
    res.json(load);
});

module.exports = router;
