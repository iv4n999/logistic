// backend/server.js - ПОЛНЫЙ КОД С АВТОРИЗАЦИЕЙ
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = require('./config');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');
const { db } = require('./services/database');

const app = express();

// Хранилище сессий (в памяти, для простоты)
const sessions = new Map();

// CORS
app.use(cors());
app.use(express.json());

// Логирование
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} | ${req.method} ${req.url}`);
    next();
});

// ==================== АВТОРИЗАЦИЯ ====================

// Проверка токена (middleware)
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Проверяем срок действия сессии (24 часа)
    const session = sessions.get(token);
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    next();
}

// Вход
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    const settings = db.getSettings();
    
    // Проверяем пароль
    if (password !== settings.adminPassword) {
        return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    // Создаём токен
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { createdAt: Date.now() });
    
    res.json({ success: true, token });
});

// Проверка авторизации
app.get('/api/auth/check', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (token && sessions.has(token)) {
        const session = sessions.get(token);
        if (Date.now() - session.createdAt < 24 * 60 * 60 * 1000) {
            return res.json({ authorized: true });
        }
    }
    
    res.json({ authorized: false });
});

// Выход
app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
        sessions.delete(token);
    }
    res.json({ success: true });
});

// ==================== МАРШРУТЫ ====================

// Публичные API
app.use('/api', ordersRouter);

// Защищённые API (админка)
app.use('/api/admin', authMiddleware, adminRouter);

// Статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));

// Страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Ошибки
app.use((err, req, res, next) => {
    console.error('❌ Ошибка:', err);
    res.status(500).json({ error: 'Server error' });
});

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║         🚀 СЕРВЕР ЗАПУЩЕН                        ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  📦 Сайт:        http://localhost:${PORT}             ║`);
    console.log(`║  ⚙️  Админка:     http://localhost:${PORT}/admin       ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    
    // Проверяем установлен ли пароль
    const settings = db.getSettings();
    if (!settings.adminPassword) {
        console.log('');
        console.log('⚠️  ВНИМАНИЕ: Пароль админки не установлен!');
        console.log('   Установите в настройках или в .env файле');
        console.log('   Временный пароль: admin123');
    }
});

process.on('SIGINT', () => {
    console.log('\n👋 Сервер остановлен');
    process.exit(0);
});