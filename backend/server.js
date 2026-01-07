// backend/server.js
const express = require('express');
const cors = require('cors');
const config = require('./config');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');

const app = express();

// CORS с настройками из конфига
app.use(cors(config.cors));
app.use(express.json());

// API routes
app.use('/api', ordersRouter);
app.use('/api/admin', adminRouter);

// Static files
app.use(express.static('../frontend'));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

app.listen(config.server.port, () => {
    console.log(`🚀 Server running on http://${config.server.host}:${config.server.port}`);
    console.log(`📦 Data directory: ${config.paths.dataDir}`);
    
    if (config.telegram.botToken) {
        console.log('✅ Telegram notifications enabled');
    } else {
        console.log('⚠️ Telegram notifications disabled (no token)');
    }
});
