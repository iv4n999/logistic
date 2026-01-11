// backend/routes/admin.js - ПОЛНЫЙ КОД С ЦЕНАМИ
const express = require('express');
const router = express.Router();
const { db } = require('../services/database');
const { sendTelegramNotification } = require('../services/telegram');

// ==================== НАПРАВЛЕНИЯ ====================

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

// ==================== НАСТРОЙКИ ====================

router.get('/settings', (req, res) => {
    res.json(db.getSettings());
});

router.put('/settings', (req, res) => {
    const settings = db.updateSettings(req.body);
    res.json(settings);
});

// ==================== ЗАЯВКИ ====================

router.get('/orders', (req, res) => {
    let orders = db.getOrders();
    
    if (req.query.status) {
        orders = orders.filter(o => o.status === req.query.status);
    }
    if (req.query.date) {
        orders = orders.filter(o => o.deliveryDate === req.query.date);
    }
    
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(orders);
});

router.get('/orders/:orderNumber', (req, res) => {
    const order = db.getOrder(req.params.orderNumber);
    if (order) {
        res.json(order);
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

router.put('/orders/:orderNumber/status', (req, res) => {
    const order = db.updateOrder(req.params.orderNumber, { status: req.body.status });
    if (order) {
        res.json(order);
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

router.delete('/orders/:orderNumber', (req, res) => {
    const order = db.deleteOrder(req.params.orderNumber);
    if (order) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

router.delete('/orders/completed', (req, res) => {
    const deleted = db.deleteCompletedOrders();
    res.json({ success: true, deleted });
});

router.post('/orders/:orderNumber/telegram', async (req, res) => {
    const order = db.getOrder(req.params.orderNumber);
    if (order) {
        await sendTelegramNotification(order);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Заявка не найдена' });
    }
});

// ==================== СЛОТЫ ====================

router.get('/slots/:directionId', (req, res) => {
    const slots = db.getSlots(parseInt(req.params.directionId));
    res.json(slots);
});

router.post('/slots', (req, res) => {
    const { directionId, date, limit } = req.body;
    
    if (!directionId || !date) {
        return res.status(400).json({ message: 'Укажите направление и дату' });
    }
    
    const slots = db.addSlot(parseInt(directionId), date, limit || 0);
    res.json(slots);
});

router.delete('/slots/:directionId/:date', (req, res) => {
    db.deleteSlot(parseInt(req.params.directionId), req.params.date);
    res.json({ success: true });
});

// ==================== ЦЕНЫ ====================

router.get('/prices', (req, res) => {
    res.json(db.getPrices());
});

router.put('/prices', (req, res) => {
    const prices = db.updatePrices(req.body);
    res.json(prices);
});

router.put('/prices/direction/:id', (req, res) => {
    const prices = db.setDirectionPrices(parseInt(req.params.id), req.body);
    res.json(prices);
});

module.exports = router;