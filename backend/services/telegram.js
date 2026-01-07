// backend/services/telegram.js
const axios = require('axios');
const { db } = require('./database');

async function sendTelegramNotification(order) {
    const settings = db.getSettings();
    const { telegramBotToken, telegramChatId } = settings;
    
    if (!telegramBotToken || !telegramChatId) {
        console.log('Telegram не настроен, пропускаем отправку');
        return;
    }
    
    const cargoTypes = {
        boxes: '📦 Короба',
        pallets: '🏗️ Палеты',
        mono_pallets: '📐 Моно-палеты'
    };
    
    const deliveryMethods = {
        pickup: '🚛 Забор',
        dropoff: '📍 Привоз'
    };
    
    const message = `
🆕 *НОВАЯ ЗАЯВКА ${order.orderNumber}*

📍 *Направление:* ${order.direction.name}
📅 *Дата поставки:* ${formatDate(order.deliveryDate)}
📅 *Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}:* ${formatDate(order.pickupDate)}

${deliveryMethods[order.deliveryMethod]}
${order.pickupAddress ? `📌 *Адрес забора:*\n${order.pickupAddress}` : ''}

${cargoTypes[order.cargoType]} × ${order.quantity}

👤 *Контакт:*
• Имя: ${order.contact.name}
• Телефон: ${order.contact.phone}
${order.contact.telegram ? `• Telegram: ${order.contact.telegram}` : ''}

${order.comment ? `💬 *Комментарий:* ${order.comment}` : ''}
    `.trim();
    
    try {
        await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log('Уведомление отправлено в Telegram');
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error.message);
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

module.exports = { sendTelegramNotification };
