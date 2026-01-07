// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', ordersRouter);
app.use('/api/admin', adminRouter);

// Static files
app.use(express.static('../frontend'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
