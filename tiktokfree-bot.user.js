// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      3.3.0
// @description  Бот: открыть TikTok -> ждем загрузку -> ищем кнопку -> вебхук -> закрыть -> проверить -> счетчик
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
        waitBeforeClose: 15000
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        
        function waitForButton(timeout = 15000) {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const selectors = [
                    '[data-e2e="follow-button"]',
                    'button[aria-label*="Подписаться"]',
                    'button[aria-label*="Follow"]',
                    'button[class*="follow"]',
                    'div[data-e2e="follow-button"] button'
                ];
                
                function check() {
                    for (const selector of selectors) {
                        try {
                            const btn = document.querySelector(selector);
                            if (btn && btn.offsetParent !== null) {
                                resolve(btn);
                                return;
                            }
                        } catch(e) {}
                    }
                    
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.innerText?.toLowerCase() || '';
                        if (text.includes('подписаться') || text.includes('follow')) {
                            resolve(btn);
                            return;
                        }
                    }
                    
                    if (Date.now() - startTime > timeout) {
                        resolve(null);
                        return;
                    }
                    
                    setTimeout(check, 500);
                }
                check();
            });
        }
        
        function waitForPageReady() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
        }
        
        async function runTikTokBot() {
            await waitForPageReady();
            await new Promise(r => setTimeout(r, 2000));
            
            const button = await waitForButton(15000);
            
            if (button) {
                console.log('✅ Найдена кнопка:', button.innerText);
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
                    })
                });
                console.log('📡 Вебхук отправлен');
            } else {
                console.log('❌ Кнопка не найдена');
                const url = SETTINGS.webhookUrl + '/follow_not_found';
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    data: JSON.stringify({ timestamp: Date.now(), url: location.href, buttonFound: false })
                });
            }
            
            // Индикатор
            const indicator = document.createElement('div');
            indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: rgba(0,0,0,0.7); color: #00ff00; padding: 4px 8px; border-radius: 4px; font-size: 10px;`;
            indicator.innerHTML = button ? '🤖 ✅ Кнопка найдена' : '🤖 ❌ Кнопка не найдена';
            document.body.appendChild(indicator);
            
            setTimeout(() => {
                window.close();
            }, SETTINGS.waitBeforeClose);
        }
        
        runTikTokBot();
        return;
    }
    
    // ========== TIKTOPFREE ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot запущен');
        
        let running = false;
        let stats = {
            completed: 0,
            earned: 0
        };
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
        
        function getTask() {
            const wrapper = document.querySelector('.task-item--wrapper');
            if (!wrapper) return null;
            
            const form = wrapper.querySelector('form');
            const id = form?.querySelector('input[name$="[id]"]')?.value;
            const execId = form?.querySelector('input[name$="[task_execution_id]"]')?.value;
            const nonce = form?.querySelector('input[name$="[nonce]"]')?.value;
            const rewardSpan = wrapper.querySelector('.btn--complete .right, .btn--complete2 .right');
            let reward = 0;
            if (rewardSpan) {
                const match = rewardSpan.innerText.match(/[\d\.]+/);
                if (match) reward = parseFloat(match[0]);
            }
            const executeUrl = wrapper.querySelector('.btn--complete2')?.href || wrapper.querySelector('.btn--complete')?.href;
            
            return { wrapper, id, execId, nonce, reward, executeUrl };
        }
        
        function clickExecute(url) {
            console.log('🔘 Открываю TikTok:', url);
            window.open(url, '_blank');
        }
        
        // Функция проверки задания и обновления статистики
        async function performCheck(task) {
            console.log('🔍 Проверяю задание...');
            
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
                console.log('📨 Ответ сервера:', text.substring(0, 200));
                
                // Проверяем успешное выполнение
                if (text.includes('успешно') || text.includes('зачислено') || text.includes('Успешно')) {
                    console.log(`✅ ЗАДАНИЕ ВЫПОЛНЕНО! +${task.reward} монет`);
                    
                    // Обновляем статистику
                    stats.completed++;
                    stats.earned += task.reward;
                    updateUI();
                    
                    // Воспроизводим звук
                    try {
                        const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                        audio.volume = 0.3;
                        audio.play().catch(e => {});
                    } catch(e) {}
                    
                    // Показываем уведомление
                    GM_notification({
                        title: '✅ Задание выполнено!',
                        text: `+${task.reward} монет. Всего: ${stats.completed}`,
                        timeout: 3000
                    });
                    
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
                    
                    if (task.wrapper) task.wrapper.remove();
                    
                    return true;
                } else if (text.includes('уже выполнено') || text.includes('already')) {
                    console.log('⚠️ Задание уже было выполнено ранее');
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
                    if (task.wrapper) task.wrapper.remove();
                    return true;
                } else {
                    console.log('❌ Задание не выполнено:', text.substring(0, 100));
                    return false;
                }
            } catch(e) {
                console.log('❌ Ошибка проверки:', e);
                return false;
            }
        }
        
        // Ждем возврата на сайт
        function waitForReturn(task) {
            if (checkInterval) clearInterval(checkInterval);
            
            return new Promise((resolve) => {
                let resolved = false;
                
                checkInterval = setInterval(async () => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(checkInterval);
                        console.log('👀 Возврат на сайт!');
                        
                        // Ищем кнопку "Проверить"
                        const checkBtn = document.querySelector('.btn--check');
                        if (checkBtn) {
                            console.log('🔘 Нажимаю кнопку "Проверить"');
                            checkBtn.click();
                            
                            // Ждем ответа сервера
                            setTimeout(async () => {
                                const success = await performCheck(task);
                                resolve(success);
                            }, 3000);
                        } else {
                            console.log('❌ Кнопка "Проверить" не найдена, пробую напрямую...');
                            const success = await performCheck(task);
                            resolve(success);
                        }
                    }
                }, 1000);
                
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(checkInterval);
                        console.log('⏰ Таймаут ожидания возврата');
                        resolve(false);
                    }
                }, 90000);
            });
        }
        
        // Выполнить одно задание
        async function doTask() {
            const task = getTask();
            if (!task) {
                console.log('❌ Нет заданий');
                return false;
            }
            
            console.log(`\n🎯 НОВОЕ ЗАДАНИЕ | Награда: +${task.reward} монет`);
            console.log(`🔗 Ссылка: ${task.executeUrl}`);
            
            clickExecute(task.executeUrl);
            
            const success = await waitForReturn(task);
            
            if (success) {
                console.log(`✅ Задание завершено! Всего выполнено: ${stats.completed}, заработано: ${stats.earned.toFixed(2)}`);
            } else {
                console.log(`❌ Задание не выполнено`);
            }
            
            return success;
        }
        
        // Запуск цикла
        async function startBot() {
            if (running) {
                console.log('⚠️ Бот уже запущен');
                return;
            }
            
            running = true;
            updateUI();
            console.log('\n🚀 БОТ ЗАПУЩЕН');
            console.log('📌 Схема работы:');
            console.log('   1. Бот открывает TikTok');
            console.log('   2. Ждет 15 секунд (MacroDroid нажимает подписку)');
            console.log('   3. Возвращаешься на сайт');
            console.log('   4. Бот нажимает "Проверить"');
            console.log('   5. Считает монеты\n');
            
            let count = 0;
            const MAX_TASKS = 100;
            
            while (running && count < MAX_TASKS) {
                const success = await doTask();
                if (success) {
                    count++;
                    console.log(`📊 Прогресс: ${count}/${MAX_TASKS} заданий`);
                }
                await new Promise(r => setTimeout(r, 2000));
                
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились, обновляю страницу...');
                    location.reload();
                    break;
                }
            }
            
            running = false;
            updateUI();
            console.log(`\n🏁 БОТ ОСТАНОВЛЕН`);
            console.log(`📊 ИТОГО: выполнено ${stats.completed} заданий, заработано ${stats.earned.toFixed(2)} монет`);
            GM_notification({
                title: '🏁 Бот остановлен',
                text: `Выполнено: ${stats.completed}, Заработано: ${stats.earned.toFixed(2)} монет`,
                timeout: 5000
            });
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            console.log('🛑 Бот остановлен вручную');
            updateUI();
        }
        
        function showStats() {
            console.log(`\n📊 СТАТИСТИКА:`);
            console.log(`   ✅ Выполнено: ${stats.completed}`);
            console.log(`   💎 Заработано: ${stats.earned.toFixed(2)} монет`);
            updateUI();
        }
        
        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        
        // Добавляем кнопку статистики в консоль
        window.botStats = showStats;
        
        updateUI();
        console.log('✅ Бот готов! Нажми СТАРТ');
        console.log('💡 Команда: botStats() - показать статистику');
    }
    
})();
