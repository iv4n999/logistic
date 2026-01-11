// backend/services/telegram.js - ПОЛНЫЙ КОД С ЦЕНАМИ
const axios = require('axios');
const { db } = require('./database');

async function sendTelegramNotification(order) {
    const settings = db.getSettings();
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        console.log('⚠️ Telegram не настроен, пропускаем отправку');
        return false;
    }
    
    console.log('📤 Отправка в Telegram...');
    
    const cargoTypes = {
        boxes: '📦 Короба',
        pallets: '🏗️ Палеты',
        mono_pallets: '📐 Моно-палеты'
    };
    
    const deliveryMethods = {
        pickup: '🚛 Мы заберём',
        dropoff: '📍 Клиент привезёт'
    };
    
    const statusEmoji = {
        new: '🆕',
        confirmed: '✅',
        in_progress: '🔄',
        completed: '✔️',
        cancelled: '❌'
    };
    
    // Формируем блок цены
    let priceBlock = '';
    if (order.price && order.price.total) {
        priceBlock = `
💰 СТОИМОСТЬ: ${order.price.total.toLocaleString('ru-RU')} ₽`;
        
        if (order.price.breakdown && order.price.breakdown.length > 0) {
            priceBlock += '\n' + order.price.breakdown.map(item => 
                `   ${item.value >= 0 ? '' : ''}${item.label}: ${item.value.toLocaleString('ru-RU')} ₽`
            ).join('\n');
        }
    }
    
    const message = `
${statusEmoji[order.status] || '🆕'} ЗАЯВКА ${order.orderNumber}

📍 Направление: ${order.direction?.name || 'Не указано'}
📅 Дата поставки: ${formatDate(order.deliveryDate)}
📅 Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}: ${formatDate(order.pickupDate)}

${deliveryMethods[order.deliveryMethod] || order.deliveryMethod}
${order.pickupAddress ? '📌 Адрес забора:\n' + order.pickupAddress : ''}
${order.pickupZoneName ? '🗺 Зона: ' + order.pickupZoneName : ''}

${cargoTypes[order.cargoType] || order.cargoType} × ${order.quantity}
${order.isUrgent ? '⚡ СРОЧНАЯ ДОСТАВКА' : ''}
${priceBlock}

👤 Контакт:
• Имя: ${order.contact?.name || 'Не указано'}
• Телефон: ${order.contact?.phone || 'Не указан'}
${order.contact?.telegram ? '• Telegram: ' + order.contact.telegram : ''}

${order.comment ? '💬 Комментарий: ' + order.comment : ''}
    `.trim();
    
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        await axios.post(url, {
            chat_id: chatId,
            text: message
        });
        
        console.log('✅ Уведомление отправлено в Telegram');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка отправки в Telegram:');
        if (error.response) {
            console.error('   Ответ:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Сообщение:', error.message);
        }
        return false;
    }
}

async function sendStatusUpdate(order, newStatus) {
    const settings = db.getSettings();
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) return false;
    
    const statusNames = {
        new: 'Новая',
        confirmed: 'Подтверждена',
        in_progress: 'В работе',
        completed: 'Завершена',
        cancelled: 'Отменена'
    };
    
    const message = `
📋 ОБНОВЛЕНИЕ ЗАЯВКИ ${order.orderNumber}

Новый статус: ${statusNames[newStatus] || newStatus}
Клиент: ${order.contact?.name || 'Не указан'}
Телефон: ${order.contact?.phone || 'Не указан'}
    `.trim();
    
    try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message
        });
        console.log('✅ Статус отправлен в Telegram');
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки статуса:', error.response?.data || error.message);
        return false;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'Не указана';
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