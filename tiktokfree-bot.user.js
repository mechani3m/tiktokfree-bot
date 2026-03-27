// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      3.0.0
// @description  Простой бот: открыть TikTok -> найти кнопку -> вебхук -> закрыть -> проверить
// @author       mechani3m
// @match        https://tiktop-free.com/tasks/*
// @match        https://tiktop-free.com/tasks
// @match        https://www.tiktok.com/*
// @match        https://m.tiktok.com/*
// @icon         https://tiktop-free.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      trigger.macrodroid.com
// @downloadURL  https://raw.githubusercontent.com/mechani3m/tiktokfree-bot/main/tiktokfree-bot.user.js
// @updateURL    https://raw.githubusercontent.com/mechani3m/tiktokfree-bot/main/tiktokfree-bot.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const isTikTok = location.hostname.includes('tiktok.com');
    const isTikTopFree = location.hostname.includes('tiktop-free.com');
    
    // ========== НАСТРОЙКИ ==========
    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        waitBeforeClose: 3000  // ждать 3 секунды перед закрытием
    };
    
    // ========== TIKTOK - ТОЛЬКО ПОИСК КНОПКИ И ВЕБХУК ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен (только поиск кнопки)');
        
        // Селекторы кнопки подписки
        const selectors = [
            '[data-e2e="follow-button"]',
            'button[aria-label*="Подписаться"]',
            'button[aria-label*="Follow"]',
            'button[class*="follow"]'
        ];
        
        // Ищем кнопку
        let button = null;
        for (const selector of selectors) {
            button = document.querySelector(selector);
            if (button) break;
        }
        
        // Если не нашли, ищем по тексту
        if (!button) {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
                if (btn.innerText.includes('Подписаться') || btn.innerText.includes('Follow')) {
                    button = btn;
                    break;
                }
            }
        }
        
        if (button) {
            console.log('✅ Найдена кнопка подписки');
            console.log('📝 Текст кнопки:', button.innerText);
            console.log('🔗 URL страницы:', location.href);
            
            // ТОЛЬКО ОТПРАВЛЯЕМ ВЕБХУК - НИЧЕГО НЕ НАЖИМАЕМ
            const url = SETTINGS.webhookUrl + '/follow';
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    timestamp: Date.now(),
                    url: location.href,
                    buttonText: button.innerText,
                    buttonFound: true
                }),
                onload: function(res) {
                    console.log('📡 Вебхук отправлен, статус:', res.status);
                },
                onerror: function() {
                    console.log('⚠️ Ошибка отправки вебхука');
                }
            });
            
        } else {
            console.log('❌ Кнопка подписки не найдена');
            
            // Отправляем вебхук что кнопка не найдена
            const url = SETTINGS.webhookUrl + '/follow_not_found';
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    timestamp: Date.now(),
                    url: location.href,
                    buttonFound: false
                })
            });
        }
        
        // Ждем и закрываем вкладку (без нажатия каких-либо кнопок)
        setTimeout(() => {
            console.log('🔚 Закрываю вкладку');
            window.close();
        }, SETTINGS.waitBeforeClose);
        
        // Визуальный индикатор (чтобы было видно что скрипт работает)
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.7);
            color: #00ff00;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-family: monospace;
        `;
        indicator.innerHTML = '🤖 Bot: ' + (button ? '✅ Кнопка найдена' : '❌ Кнопка не найдена');
        document.body.appendChild(indicator);
        
        // Убираем индикатор через 3 секунды
        setTimeout(() => indicator.remove(), 3000);
        
        return;
    }
    
    // ========== TIKTOPFREE - ОСНОВНОЙ БОТ ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot запущен');
        
        let running = false;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;
        
        // Создаем панель
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 12px;
            border-radius: 12px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            min-width: 200px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <b>🤖 TikTokFree Bot</b>
                <span id="bot-status" style="background: #f44336; padding: 2px 8px; border-radius: 20px;">СТОП</span>
            </div>
            <div>💰 Баланс: <span id="balance">0</span></div>
            <div>✅ Выполнено: <span id="completed">0</span></div>
            <div>💎 Заработано: <span id="earned">0</span></div>
            <button id="start-btn" style="margin-top: 8px; width: 100%; padding: 6px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer;">▶ СТАРТ</button>
            <button id="stop-btn" style="margin-top: 4px; width: 100%; padding: 6px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">⏹ СТОП</button>
        `;
        document.body.appendChild(panel);
        
        function updateUI() {
            const balance = document.querySelector('.user-balance')?.innerText || '0';
            document.getElementById('balance').innerText = balance;
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
            document.getElementById('bot-status').innerText = running ? 'РАБОТАЕТ' : 'СТОП';
            document.getElementById('bot-status').style.background = running ? '#4caf50' : '#f44336';
        }
        
        // Получить текущее задание
        function getTask() {
            const wrapper = document.querySelector('.task-item--wrapper');
            if (!wrapper) return null;
            
            const form = wrapper.querySelector('form');
            const id = form?.querySelector('input[name$="[id]"]')?.value;
            const execId = form?.querySelector('input[name$="[task_execution_id]"]')?.value;
            const nonce = form?.querySelector('input[name$="[nonce]"]')?.value;
            const rewardSpan = wrapper.querySelector('.btn--complete .right, .btn--complete2 .right');
            const reward = rewardSpan ? parseFloat(rewardSpan.innerText.match(/[\d\.]+/)[0]) : 0;
            const executeUrl = wrapper.querySelector('.btn--complete2')?.href || wrapper.querySelector('.btn--complete')?.href;
            
            return { wrapper, id, execId, nonce, reward, executeUrl };
        }
        
        // Нажать "Выполнить" (открыть TikTok)
        function clickExecute(url) {
            console.log('🔘 Открываю TikTok');
            window.open(url, '_blank');
        }
        
        // Нажать "Проверить"
        async function clickCheck(task) {
            const formData = new FormData();
            formData.append('UserPerformTask[id]', task.id);
            formData.append('UserPerformTask[task_execution_id]', task.execId);
            formData.append('UserPerformTask[nonce]', task.nonce);
            formData.append('UserPerformTask[submit]', 'check');
            
            try {
                const res = await fetch('/lightning-action.php?action=tiktokfree_user_perform_task', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const text = await res.text();
                
                if (text.includes('успешно') || text.includes('зачислено')) {
                    console.log(`✅ Выполнено! +${task.reward} монет`);
                    stats.completed++;
                    stats.earned += task.reward;
                    updateUI();
                    
                    // Скрываем задание
                    const hideData = new FormData();
                    hideData.append('UserPerformTask[id]', task.id);
                    hideData.append('UserPerformTask[task_execution_id]', task.execId);
                    hideData.append('UserPerformTask[nonce]', task.nonce);
                    hideData.append('UserPerformTask[submit]', 'hide');
                    fetch('/lightning-action.php?action=tiktokfree_user_perform_task', {
                        method: 'POST',
                        body: hideData,
                        credentials: 'same-origin'
                    });
                    task.wrapper?.remove();
                    
                    return true;
                }
                return false;
            } catch(e) {
                console.log('Ошибка проверки:', e);
                return false;
            }
        }
        
        // Ждем возврата на сайт
        function waitForReturn() {
            if (checkInterval) clearInterval(checkInterval);
            
            return new Promise((resolve) => {
                let resolved = false;
                
                checkInterval = setInterval(async () => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(checkInterval);
                        console.log('👀 Возврат на сайт, проверяю...');
                        
                        const task = getTask();
                        if (task) {
                            const success = await clickCheck(task);
                            resolve(success);
                        } else {
                            resolve(false);
                        }
                    }
                }, 1000);
                
                // Таймаут 60 секунд
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(checkInterval);
                        console.log('⏰ Таймаут ожидания');
                        resolve(false);
                    }
                }, 60000);
            });
        }
        
        // Выполнить одно задание
        async function doTask() {
            const task = getTask();
            if (!task) {
                console.log('❌ Нет заданий');
                return false;
            }
            
            console.log(`🎯 Задание: +${task.reward} монет | Ссылка: ${task.executeUrl}`);
            clickExecute(task.executeUrl);
            
            // Ждем возврата и проверяем
            const success = await waitForReturn();
            return success;
        }
        
        // Запуск цикла
        async function startBot() {
            if (running) return;
            running = true;
            updateUI();
            console.log('🚀 Бот запущен');
            
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                
                // Если заданий нет, обновляем
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились, обновляю...');
                    location.reload();
                    break;
                }
            }
            
            running = false;
            updateUI();
            console.log(`🏁 Бот остановлен. Выполнено: ${stats.completed}, Заработано: ${stats.earned.toFixed(2)}`);
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            console.log('🛑 Бот остановлен');
            updateUI();
        }
        
        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        updateUI();
        
        console.log('✅ Бот готов! Нажми СТАРТ');
    }
    
})();
