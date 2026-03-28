// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      3.5.0
// @description  Бот с автозапуском после обновления и отслеживанием тост-уведомлений
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
// @grant        GM_deleteValue
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
        waitBeforeClose: 25000,
        autoStartDelay: 5000  // Задержка перед автозапуском 5 секунд
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        
        function waitForButton(timeout = 25000) {
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
            
            const indicator = document.createElement('div');
            indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: rgba(0,0,0,0.7); color: #00ff00; padding: 4px 8px; border-radius: 4px; font-size: 10px;`;
            indicator.innerHTML = button ? '🤖 ✅ Кнопка найдена, вебхук отправлен' : '🤖 ❌ Кнопка не найдена';
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
        let autoStartTimer = null;
        let stats = {
            completed: 0,
            earned: 0
        };
        let checkInterval = null;
        let toastObserver = null;
        
        // Загружаем сохраненную статистику
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) {
            stats = savedStats;
            console.log('📊 Загружена сохраненная статистика:', stats);
        }
        
        // Проверяем, был ли бот запущен до обновления
        const wasRunning = GM_getValue('botWasRunning', false);
        if (wasRunning) {
            console.log('🔄 Бот был запущен до обновления страницы');
            GM_deleteValue('botWasRunning');
        }
        
        // Сохраняем статистику
        function saveStats() {
            GM_setValue('botStats', stats);
        }
        
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
            min-width: 220px;
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
            <hr style="margin: 6px 0; opacity: 0.3;">
            <div style="font-size: 10px;" id="auto-status">⏳ Автозапуск через 5 сек...</div>
            <button id="start-btn" style="margin-top: 8px; width: 100%; padding: 6px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer;">▶ СТАРТ</button>
            <button id="stop-btn" style="margin-top: 4px; width: 100%; padding: 6px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">⏹ СТОП</button>
            <button id="reset-stats" style="margin-top: 4px; width: 100%; padding: 4px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 10px;">🔄 Сбросить статистику</button>
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
        
        function updateAutoStatus(text) {
            const statusEl = document.getElementById('auto-status');
            if (statusEl) statusEl.innerHTML = text;
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
        
        // Ожидание появления тост-уведомления
        function waitForToast(timeout = 30000) {
            return new Promise((resolve) => {
                console.log('👀 Ожидаю появление тост-уведомления "Вы успешно выполнили задание!"...');
                
                // Проверяем существующие тосты
                const existingToasts = document.querySelectorAll('.toast');
                for (const toast of existingToasts) {
                    const text = toast.innerText || toast.textContent;
                    if (text.includes('успешно') || text.includes('зачислено') || text.includes('Выполнили')) {
                        console.log('✅ Тост уже есть:', text);
                        resolve({ success: true, text: text });
                        return;
                    }
                }
                
                let observer = null;
                let timeoutId = null;
                
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1) {
                                if (node.classList && node.classList.contains('toast')) {
                                    const text = node.innerText || node.textContent;
                                    if (text.includes('успешно') || text.includes('зачислено') || text.includes('Выполнили')) {
                                        console.log('✅ Найдено тост-уведомление:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: true, text: text });
                                        return;
                                    }
                                }
                                const toast = node.querySelector?.('.toast');
                                if (toast) {
                                    const text = toast.innerText;
                                    if (text.includes('успешно') || text.includes('зачислено')) {
                                        console.log('✅ Найдено тост-уведомление внутри:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: true, text: text });
                                        return;
                                    }
                                }
                            }
                        }
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });
                
                timeoutId = setTimeout(() => {
                    console.log('⏰ Таймаут: тост-уведомление не появилось');
                    if (observer) observer.disconnect();
                    resolve({ success: false, text: null });
                }, timeout);
            });
        }
        
        // Нажать кнопку "Проверить" и ждать тост
        async function clickCheckAndWait(task) {
            console.log('🔍 Нажимаю "Проверить" и жду подтверждения...');
            
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) {
                console.log('❌ Кнопка "Проверить" не найдена');
                return false;
            }
            
            checkBtn.click();
            console.log('🔘 Кнопка "Проверить" нажата');
            
            const toastResult = await waitForToast(15000);
            
            if (toastResult.success) {
                console.log(`✅ ЗАДАНИЕ ВЫПОЛНЕНО! +${task.reward} монет`);
                console.log(`📝 Сообщение: ${toastResult.text}`);
                
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();
                
                try {
                    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                    audio.volume = 0.3;
                    audio.play().catch(e => {});
                } catch(e) {}
                
                GM_notification({
                    title: '✅ Задание выполнено!',
                    text: `+${task.reward} монет. Всего: ${stats.completed} заданий, ${stats.earned.toFixed(2)} монет`,
                    timeout: 3000
                });
                
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
                console.log('❌ Тост-уведомление не появилось, задание не выполнено');
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
                        
                        setTimeout(async () => {
                            const success = await clickCheckAndWait(task);
                            resolve(success);
                        }, 2000);
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
                console.log(`📊 Итого: выполнено ${stats.completed} заданий, заработано ${stats.earned.toFixed(2)} монет`);
            }
            
            return success;
        }
        
        // Запуск цикла
        async function startBot(showMessage = true) {
            if (running) {
                console.log('⚠️ Бот уже запущен');
                return;
            }
            
            running = true;
            updateUI();
            
            if (showMessage) {
                console.log('\n🚀 БОТ ЗАПУЩЕН');
                console.log('📌 Схема работы:');
                console.log('   1. Бот открывает TikTok');
                console.log('   2. Ждет 15 секунд (MacroDroid нажимает подписку)');
                console.log('   3. Возвращаешься на сайт');
                console.log('   4. Бот нажимает "Проверить"');
                console.log('   5. Ждет тост "Вы успешно выполнили задание!"');
                console.log('   6. Считает монеты\n');
            }
            
            let count = 0;
            const MAX_TASKS = 100;
            
            while (running && count < MAX_TASKS) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились, обновляю страницу...');
                    GM_setValue('botWasRunning', true);
                    setTimeout(() => location.reload(), 2000);
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
            if (autoStartTimer) clearTimeout(autoStartTimer);
            updateAutoStatus('⏹ Бот остановлен');
            console.log('🛑 Бот остановлен вручную');
            updateUI();
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 Статистика сброшена');
            GM_notification({ title: 'Статистика сброшена', text: 'Счетчик обнулен', timeout: 2000 });
        }
        
        function showStats() {
            console.log(`\n📊 СТАТИСТИКА:`);
            console.log(`   ✅ Выполнено: ${stats.completed}`);
            console.log(`   💎 Заработано: ${stats.earned.toFixed(2)} монет`);
            updateUI();
        }
        
        // Автозапуск с паузой
        function scheduleAutoStart() {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            
            let secondsLeft = SETTINGS.autoStartDelay / 1000;
            updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек... (нажми СТОП для отмены)`);
            
            const countdown = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0 && !running) {
                    updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек... (нажми СТОП для отмены)`);
                }
                if (secondsLeft <= 0 || running) {
                    clearInterval(countdown);
                }
            }, 1000);
            
            autoStartTimer = setTimeout(() => {
                if (!running) {
                    updateAutoStatus('🚀 Автозапуск...');
                    startBot(true);
                }
            }, SETTINGS.autoStartDelay);
        }
        
        document.getElementById('start-btn').onclick = () => {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            updateAutoStatus('▶ Запуск вручную...');
            startBot(true);
        };
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        
        window.botStats = showStats;
        window.resetStats = resetStats;
        
        updateUI();
        
        // Запускаем автозапуск с паузой
        scheduleAutoStart();
        
        console.log('✅ Бот готов!');
        console.log('💡 Команды: botStats() - статистика, resetStats() - сброс');
        console.log(`⏳ Автозапуск через ${SETTINGS.autoStartDelay / 1000} секунд...`);
    }
    
})();
