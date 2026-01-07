// backend/services/telegram.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД
const axios = require('axios');
const { db } = require('./database');

async function sendTelegramNotification(order) {
    const settings = db.getSettings();
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    
    // Проверка настроек
    if (!botToken || !chatId) {
        console.log('⚠️ Telegram не настроен, пропускаем отправку');
        return false;
    }
    
    console.log('📤 Отправка в Telegram...');
    console.log('   Chat ID:', chatId);
    console.log('   Token:', botToken.substring(0, 10) + '...');
    
    const cargoTypes = {
        boxes: '📦 Короба',
        pallets: '🏗️ Палеты',
        mono_pallets: '📐 Моно-палеты'
    };
    
    const deliveryMethods = {
        pickup: '🚛 Мы заберём',
        dropoff: '📍 Клиент привезёт'
    };
    
    // Сообщение БЕЗ Markdown (чтобы избежать ошибок форматирования)
    const message = `
🆕 НОВАЯ ЗАЯВКА ${order.orderNumber}

📍 Направление: ${order.direction?.name || 'Не указано'}
📅 Дата поставки: ${formatDate(order.deliveryDate)}
📅 Дата ${order.deliveryMethod === 'pickup' ? 'забора' : 'привоза'}: ${formatDate(order.pickupDate)}

${deliveryMethods[order.deliveryMethod] || order.deliveryMethod}
${order.pickupAddress ? '📌 Адрес забора:\n' + order.pickupAddress : ''}

${cargoTypes[order.cargoType] || order.cargoType} × ${order.quantity}

👤 Контакт:
• Имя: ${order.contact?.name || 'Не указано'}
• Телефон: ${order.contact?.phone || 'Не указан'}
${order.contact?.telegram ? '• Telegram: ' + order.contact.telegram : ''}

${order.comment ? '💬 Комментарий: ' + order.comment : ''}
    `.trim();
    
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        const response = await axios.post(url, {
            chat_id: chatId,
            text: message
            // Убрали parse_mode: 'Markdown' - это часто вызывает ошибку 400
        });
        
        console.log('✅ Уведомление отправлено в Telegram');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка отправки в Telegram:');
        
        if (error.response) {
            console.error('   Статус:', error.response.status);
            console.error('   Ответ:', JSON.stringify(error.response.data, null, 2));
            
            // Подсказки по ошибкам
            const errorCode = error.response.data?.error_code;
            const description = error.response.data?.description || '';
            
            if (description.includes('chat not found')) {
                console.error('   💡 Подсказка: Неверный Chat ID или бот не добавлен в чат');
            }
            if (description.includes('bot was blocked')) {
                console.error('   💡 Подсказка: Бот заблокирован пользователем');
            }
            if (description.includes('Forbidden')) {
                console.error('   💡 Подсказка: Бот не имеет доступа к этому чату');
            }
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