// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      3.2.0
// @description  Бот: открыть TikTok -> ждем загрузку -> ищем кнопку -> вебхук -> закрыть через 15 сек -> проверить
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
        waitBeforeClose: 15000  // ЖДЕМ 15 СЕКУНД перед закрытием
    };
    
    // ========== TIKTOK - ЖДЕМ ЗАГРУЗКИ И ПОТОМ ИЩЕМ КНОПКУ ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        console.log('⏳ Ожидание полной загрузки страницы...');
        
        // Функция ожидания появления кнопки (до 15 секунд)
        function waitForButton(timeout = 15000) {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const selectors = [
                    '[data-e2e="follow-button"]',
                    'button[aria-label*="Подписаться"]',
                    'button[aria-label*="Follow"]',
                    'button[class*="follow"]',
                    'div[data-e2e="follow-button"] button',
                    '[class*="FollowButton"] button',
                    'button[data-e2e="follow-button"]'
                ];
                
                function check() {
                    // Ищем по селекторам
                    for (const selector of selectors) {
                        try {
                            const btn = document.querySelector(selector);
                            if (btn && btn.offsetParent !== null) {
                                console.log(`✅ Найдена кнопка по селектору: ${selector}`);
                                resolve(btn);
                                return;
                            }
                        } catch(e) {}
                    }
                    
                    // Ищем по тексту
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.innerText?.toLowerCase() || '';
                        if (text.includes('подписаться') || text.includes('follow')) {
                            console.log(`✅ Найдена кнопка по тексту: "${btn.innerText}"`);
                            resolve(btn);
                            return;
                        }
                    }
                    
                    // Проверяем таймаут
                    if (Date.now() - startTime > timeout) {
                        console.log('❌ Кнопка не найдена за', timeout / 1000, 'секунд');
                        resolve(null);
                        return;
                    }
                    
                    // Проверяем каждые 500мс
                    setTimeout(check, 500);
                }
                
                // Начинаем поиск
                check();
            });
        }
        
        // Функция ожидания полной загрузки страницы
        function waitForPageReady() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    console.log('✅ Страница уже загружена');
                    resolve();
                } else {
                    console.log('⏳ Ожидаем событие load...');
                    window.addEventListener('load', () => {
                        console.log('✅ Событие load произошло');
                        resolve();
                    });
                }
            });
        }
        
        // Основная функция
        async function runTikTokBot() {
            // Ждем полной загрузки страницы
            await waitForPageReady();
            
            // Дополнительная задержка для динамического контента (2 секунды)
            console.log('⏳ Дополнительная задержка 2 секунды для динамического контента...');
            await new Promise(r => setTimeout(r, 2000));
            console.log('✅ Начинаю поиск кнопки');
            
            // Ищем кнопку (ждем до 15 секунд)
            const button = await waitForButton(15000);
            
            if (button) {
                console.log('🎯 Кнопка подписки найдена!');
                console.log('📝 Текст кнопки:', button.innerText);
                console.log('🔗 URL страницы:', location.href);
                
                // Отправляем вебхук
                const url = SETTINGS.webhookUrl + '/follow';
                console.log('📡 Отправка вебхука на:', url);
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
                    onerror: function(err) {
                        console.log('⚠️ Ошибка отправки вебхука:', err);
                    }
                });
                
            } else {
                console.log('❌ Кнопка подписки не найдена за 15 секунд');
                
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
            
            // Создаем таймер обратного отсчета
            let secondsLeft = SETTINGS.waitBeforeClose / 1000;
            const timerDiv = document.createElement('div');
            timerDiv.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                z-index: 9999;
                background: rgba(0,0,0,0.8);
                color: #ffaa00;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 14px;
                font-family: monospace;
                font-weight: bold;
                z-index: 10000;
            `;
            timerDiv.innerHTML = `⏳ Закрытие через: ${secondsLeft} сек`;
            document.body.appendChild(timerDiv);
            
            const timerInterval = setInterval(() => {
                secondsLeft--;
                if (timerDiv) timerDiv.innerHTML = `⏳ Закрытие через: ${secondsLeft} сек`;
                if (secondsLeft <= 0) {
                    clearInterval(timerInterval);
                    if (timerDiv) timerDiv.remove();
                }
            }, 1000);
            
            // Визуальный индикатор
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                bottom: 10px;
                left: 10px;
                z-index: 9999;
                background: rgba(0,0,0,0.7);
                color: ${button ? '#00ff00' : '#ff0000'};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-family: monospace;
            `;
            indicator.innerHTML = button ? '🤖 ✅ Кнопка найдена, вебхук отправлен' : '🤖 ❌ Кнопка не найдена';
            document.body.appendChild(indicator);
            
            // Ждем и закрываем вкладку
            setTimeout(() => {
                console.log('🔚 Закрываю вкладку');
                if (indicator) indicator.remove();
                if (timerDiv) timerDiv.remove();
                window.close();
            }, SETTINGS.waitBeforeClose);
        }
        
        // Запускаем бота
        runTikTokBot();
        
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
                        
                        const checkBtn = document.querySelector('.btn--check');
                        if (checkBtn) {
                            console.log('✅ Найдена кнопка "Проверить", нажимаю...');
                            checkBtn.click();
                            
                            setTimeout(async () => {
                                const task = getTask();
                                if (task) {
                                    const success = await clickCheck(task);
                                    resolve(success);
                                } else {
                                    resolve(false);
                                }
                            }, 2000);
                        } else {
                            console.log('❌ Кнопка "Проверить" не найдена');
                            resolve(false);
                        }
                    }
                }, 1000);
                
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
