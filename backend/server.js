// backend/server.js - ПОЛНЫЙ КОД
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = require('./config');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');

const app = express();

// CORS настройки
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Парсинг JSON
app.use(express.json());

// Логирование запросов (для отладки)
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} | ${req.method} ${req.url}`);
    next();
});

// API маршруты
app.use('/api', ordersRouter);
app.use('/api/admin', adminRouter);

// Статические файлы (CSS, JS, изображения)
app.use(express.static(path.join(__dirname, '../frontend')));

// Главная страница - форма заказа
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Админ-панель
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Также поддерживаем /admin.html
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Health check - проверка работоспособности
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Обработка 404 - страница не найдена
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Страница не найдена',
        path: req.url 
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err);
    res.status(500).json({ 
        error: 'Внутренняя ошибка сервера',
        message: err.message 
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║         🚀 СЕРВЕР УСПЕШНО ЗАПУЩЕН!               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║                                                  ║');
    console.log(`║  📦 Форма заказа:   http://${HOST}:${PORT}            ║`);
    console.log(`║  ⚙️  Админ-панель:   http://${HOST}:${PORT}/admin      ║`);
    console.log('║                                                  ║');
    console.log('╠══════════════════════════════════════════════════╣');
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        console.log('║  ✅ Telegram уведомления: ВКЛЮЧЕНЫ              ║');
    } else {
        console.log('║  ⚠️  Telegram уведомления: ВЫКЛЮЧЕНЫ             ║');
        console.log('║     (добавьте TELEGRAM_BOT_TOKEN в .env)        ║');
    }
    
    console.log('║                                                  ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Логи запросов:');
    console.log('─'.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Сервер остановлен');
    process.exit(0);
});