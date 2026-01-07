// backend/services/telegram.js
const axios = require('axios');
const config = require('../config');
const { db } = require('./database');

async function sendTelegramNotification(order) {
    const settings = db.getSettings();
    const botToken = settings.telegramBotToken || config.telegram.botToken;
    const chatId = settings.telegramChatId || config.telegram.chatId;
    
    if (!botToken || !chatId) {
        console.log('⚠️ Telegram не настроен, пропускаем отправку');
        return false;
    }
    
    const cargoType = config.getCargoType(order.cargoType);
    const deliveryMethod = config.getDeliveryMethod(order.deliveryMethod);
    
    const message = `
🆕 *НОВАЯ ЗАЯВКА ${order.orderNumber}*

📍 *Направление:* ${order.direction.name}
📅 *Дата поставки:* ${formatDate(order.deliveryDate)}
📅 *Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}:* ${formatDate(order.pickupDate)}

${deliveryMethod.icon} ${deliveryMethod.name}
${order.pickupAddress ? `📌 *Адрес забора:*\n${order.pickupAddress}` : ''}

${cargoType.icon} ${cargoType.name} × ${order.quantity}

👤 *Контакт:*
• Имя: ${order.contact.name}
• Телефон: ${order.contact.phone}
${order.contact.telegram ? `• Telegram: ${order.contact.telegram}` : ''}

${order.comment ? `💬 *Комментарий:* ${order.comment}` : ''}
    `.trim();
    
    try {
        await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            }
        );
        console.log('✅ Уведомление отправлено в Telegram');
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки в Telegram:', error.message);
        return false;
    }
}

async function sendStatusUpdate(order, newStatus) {
    const settings = db.getSettings();
    const botToken = settings.telegramBotToken || config.telegram.botToken;
    const chatId = settings.telegramChatId || config.telegram.chatId;
    
    if (!botToken || !chatId) return false;
    
    const statusName = config.getStatusName(newStatus);
    
    const message = `
📋 *ОБНОВЛЕНИЕ ЗАЯВКИ ${order.orderNumber}*

Новый статус: *${statusName}*
Клиент: ${order.contact.name}
Телефон: ${order.contact.phone}
    `.trim();
    
    try {
        await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            }
        );
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки в Telegram:', error.message);
        return false;
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

module.exports = { 
    sendTelegramNotification,
    sendStatusUpdate 
};