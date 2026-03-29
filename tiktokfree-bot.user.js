// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      7.1.0
// @description  Сбалансированная версия: нормальные паузы
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
    
    // ========== НАСТРОЙКИ (НОРМАЛЬНЫЕ ПАУЗЫ) ==========
    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        
        // Время ожидания в TikTok
        waitAfterFound: 15000,        // 15 секунд если кнопка найдена (MacroDroid успеет нажать)
        waitAfterNotFound: 3000,      // 3 секунды если кнопка не найдена (успеваем отправить статус)
        
        // Поиск кнопки
        searchAttempts: 10,           // 10 попыток
        searchInterval: 500,          // каждые 500мс = 5 секунд максимум
        
        // Автозапуск
        autoStartDelay: 5000,         // 5 секунд перед автозапуском
        
        // После возврата на сайт
        checkDelayAfterReturn: 2000,  // 2 секунды паузы перед проверкой
        
        // При ошибке "Упс!"
        retryDelay: 5000              // 5 секунд перед повторной проверкой
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot v7.1 запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || GM_getValue('current_task_type', 'follow');
        
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        function sendWebhook(action, data) {
            const url = SETTINGS.webhookUrl + action;
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    timestamp: Date.now(),
                    url: location.href,
                    taskType: taskType,
                    ...data
                })
            });
        }
        
        function sendHideStatus() {
            console.log('📡 Отправка статуса скрытия...');
            GM_setValue('hide_current_task', 'true');
            GM_setValue('hide_task_reason', `button_${taskType}_not_found`);
            GM_setValue('hide_task_timestamp', Date.now());
            sessionStorage.setItem('hide_current_task', 'true');
            localStorage.setItem('hide_current_task', 'true');
        }
        
        async function findFollowButton() {
            const selectors = [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]',
                'div[data-e2e="follow-button"] button'
            ];
            
            for (let attempt = 0; attempt < SETTINGS.searchAttempts; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            console.log(`✅ Кнопка подписки найдена на попытке ${attempt + 1}`);
                            return btn;
                        }
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('подписаться') || text.includes('follow')) {
                        console.log(`✅ Кнопка подписки найдена по тексту на попытке ${attempt + 1}`);
                        return btn;
                    }
                }
                
                if (attempt < SETTINGS.searchAttempts - 1) {
                    await delay(SETTINGS.searchInterval);
                }
            }
            return null;
        }
        
        async function findLikeButton() {
            const selectors = [
                '[data-e2e="like-button"]',
                'button[aria-label*="Нравится"]',
                'button[aria-label*="Like"]',
                'span[data-e2e="like-icon"]',
                '[data-e2e*="like"]'
            ];
            
            for (let attempt = 0; attempt < SETTINGS.searchAttempts; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            console.log(`✅ Кнопка лайка найдена на попытке ${attempt + 1}`);
                            return btn;
                        }
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('нравится') || text.includes('like')) {
                        console.log(`✅ Кнопка лайка найдена по тексту на попытке ${attempt + 1}`);
                        return btn;
                    }
                }
                
                if (attempt < SETTINGS.searchAttempts - 1) {
                    await delay(SETTINGS.searchInterval);
                }
            }
            return null;
        }
        
        async function run() {
            console.log('🔍 Начинаю поиск кнопки...');
            console.log(`⏳ Максимальное время поиска: ${(SETTINGS.searchAttempts * SETTINGS.searchInterval) / 1000} секунд`);
            
            // Ждем начальной загрузки страницы
            await delay(1500);
            
            let button = null;
            
            if (taskType === 'follow') {
                button = await findFollowButton();
            } else {
                button = await findLikeButton();
            }
            
            if (button) {
                console.log(`✅ Кнопка ${taskType} найдена!`);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #0a0; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: bold;`;
                indicator.innerHTML = `✅ Кнопка найдена! Ждем ${SETTINGS.waitAfterFound / 1000} сек`;
                document.body.appendChild(indicator);
                
                console.log(`⏳ Ждем ${SETTINGS.waitAfterFound / 1000} секунд перед закрытием...`);
                setTimeout(() => {
                    console.log('🔚 Закрываю вкладку (кнопка найдена)');
                    window.close();
                }, SETTINGS.waitAfterFound);
                
            } else {
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА за ${(SETTINGS.searchAttempts * SETTINGS.searchInterval) / 1000} секунд`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                
                // Отправляем статус скрытия
                sendHideStatus();
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #a00; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: bold;`;
                indicator.innerHTML = `❌ Кнопка НЕ найдена! Ждем ${SETTINGS.waitAfterNotFound / 1000} сек`;
                document.body.appendChild(indicator);
                
                console.log(`⏳ Ждем ${SETTINGS.waitAfterNotFound / 1000} секунд перед закрытием...`);
                setTimeout(() => {
                    console.log('🔚 Закрываю вкладку (кнопка не найдена)');
                    window.close();
                }, SETTINGS.waitAfterNotFound);
            }
        }
        
        // Запускаем после загрузки DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
        
        return;
    }
    
    // ========== TIKTOPFREE ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot v7.1 запущен');
        
        let running = false;
        let autoStartTimer = null;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;
        let retryCount = 0;
        const MAX_RETRY = 2;
        
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) stats = savedStats;
        
        function saveStats() {
            GM_setValue('botStats', stats);
        }
        
        function getTaskType() {
            const titleEl = document.querySelector('.list-item--title.task-item--title');
            if (!titleEl) return null;
            const titleText = titleEl.innerText;
            if (titleText.includes('Подписаться')) return { type: 'follow', name: 'Подписка' };
            if (titleText.includes('лайк') || titleText.includes('Like')) return { type: 'like', name: 'Лайк' };
            return null;
        }
        
        function hideCurrentTask() {
            console.log('🗑 Скрываю задание...');
            const hideBtn = document.querySelector('.task-item--wrapper .btn--close');
            if (hideBtn) {
                hideBtn.click();
                console.log('✅ Задание скрыто');
                return true;
            }
            return false;
        }
        
        function shouldHideTask() {
            const gmHide = GM_getValue('hide_current_task', null);
            const sessionHide = sessionStorage.getItem('hide_current_task');
            const localHide = localStorage.getItem('hide_current_task');
            
            if (gmHide === 'true' || sessionHide === 'true' || localHide === 'true') {
                console.log('⚠️ НАЙДЕН ФЛАГ СКРЫТИЯ!');
                
                // Очищаем
                GM_deleteValue('hide_current_task');
                GM_deleteValue('hide_task_reason');
                sessionStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_current_task');
                
                return true;
            }
            return false;
        }
        
        function waitForToast(timeout = 15000) {
            return new Promise((resolve) => {
                const checkToasts = () => {
                    const toasts = document.querySelectorAll('.toast');
                    for (const toast of toasts) {
                        const text = toast.innerText;
                        if (text.includes('успешно') || text.includes('зачислено')) {
                            return { success: true, text };
                        }
                        if (text.includes('Упс') || text.includes('не выполнили')) {
                            return { success: false, error: true, text };
                        }
                    }
                    return null;
                };
                
                const existing = checkToasts();
                if (existing) {
                    resolve(existing);
                    return;
                }
                
                let observer = new MutationObserver(() => {
                    const result = checkToasts();
                    if (result) {
                        observer.disconnect();
                        resolve(result);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                setTimeout(() => {
                    observer.disconnect();
                    resolve({ success: false, error: false, text: null });
                }, timeout);
            });
        }
        
        async function clickCheck(task, isRetry = false) {
            console.log(`🔍 Проверка задания (${isRetry ? 'повторная' : 'первая'})...`);
            
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;
            
            checkBtn.click();
            console.log('🔘 Кнопка "Проверить" нажата');
            
            const result = await waitForToast(15000);
            
            if (result.success) {
                console.log(`✅ ВЫПОЛНЕНО! +${task.reward} монет`);
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();
                
                // Звук
                try {
                    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                    audio.volume = 0.3;
                    audio.play();
                } catch(e) {}
                
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
                task.wrapper?.remove();
                
                retryCount = 0;
                return true;
            }
            
            if (result.error) {
                console.log(`⚠️ Ошибка: ${result.text}`);
                
                if (isRetry) {
                    console.log('❌ Повторная ошибка, скрываю задание');
                    hideCurrentTask();
                    retryCount = 0;
                    return false;
                } else {
                    console.log(`🔄 Пауза ${SETTINGS.retryDelay / 1000} секунд, затем повторная проверка...`);
                    retryCount++;
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheck(task, true);
                }
            }
            
            console.log('❌ Тост не появился');
            return false;
        }
        
        function waitForReturn(task) {
            return new Promise((resolve) => {
                let resolved = false;
                
                const interval = setInterval(() => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(interval);
                        console.log('👀 Возврат на сайт!');
                        
                        // Проверяем флаг скрытия
                        if (shouldHideTask()) {
                            console.log('✅ Флаг найден! Скрываю задание без проверки');
                            hideCurrentTask();
                            resolve(false);
                            return;
                        }
                        
                        // Пауза перед проверкой
                        console.log(`⏳ Пауза ${SETTINGS.checkDelayAfterReturn / 1000} секунд перед проверкой...`);
                        setTimeout(async () => {
                            const success = await clickCheck(task, false);
                            resolve(success);
                        }, SETTINGS.checkDelayAfterReturn);
                    }
                }, 500);
                
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(interval);
                        console.log('⏰ Таймаут ожидания возврата (60 секунд)');
                        resolve(false);
                    }
                }, 60000);
            });
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
            const taskType = getTaskType();
            
            return { wrapper, id, execId, nonce, reward, executeUrl, taskType };
        }
        
        function clickExecute(url, taskType) {
            GM_setValue('current_task_type', taskType?.type || 'follow');
            const separator = url.includes('?') ? '&' : '?';
            window.open(`${url}${separator}task_type=${taskType?.type || 'follow'}`, '_blank');
        }
        
        async function doTask() {
            // Проверяем флаг перед началом
            if (shouldHideTask()) {
                console.log('⚠️ Был флаг скрытия, пропускаем задание');
                return false;
            }
            
            const task = getTask();
            if (!task || !task.taskType) return false;
            
            console.log(`\n🎯 ${task.taskType.name} | Награда: +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            
            const success = await waitForReturn(task);
            return success;
        }
        
        // UI панель
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
            <button id="start-btn" style="width: 100%; padding: 6px; background: #4caf50; border: none; border-radius: 6px; cursor: pointer; color: white; margin-bottom: 4px;">▶ СТАРТ</button>
            <button id="stop-btn" style="width: 100%; padding: 6px; background: #f44336; border: none; border-radius: 6px; cursor: pointer; color: white; margin-bottom: 4px;">⏹ СТОП</button>
            <button id="reset-stats" style="width: 100%; padding: 4px; background: #ff9800; border: none; border-radius: 6px; cursor: pointer; font-size: 10px; color: white;">🔄 Сбросить статистику</button>
        `;
        document.body.appendChild(panel);
        
        function updateUI() {
            const balance = document.querySelector('.user-balance')?.innerText || '0';
            document.getElementById('balance').innerText = balance;
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
            const statusEl = document.getElementById('bot-status');
            statusEl.innerText = running ? 'РАБОТАЕТ' : 'СТОП';
            statusEl.style.background = running ? '#4caf50' : '#f44336';
        }
        
        async function startBot() {
            if (running) return;
            running = true;
            updateUI();
            
            console.log('\n🚀 БОТ ЗАПУЩЕН v7.1');
            console.log('📌 Настройки пауз:');
            console.log(`   • Поиск кнопки: до ${(SETTINGS.searchAttempts * SETTINGS.searchInterval) / 1000} секунд`);
            console.log(`   • Если кнопка найдена: ждем ${SETTINGS.waitAfterFound / 1000} секунд`);
            console.log(`   • Если кнопка НЕ найдена: ждем ${SETTINGS.waitAfterNotFound / 1000} секунд`);
            console.log(`   • После возврата: пауза ${SETTINGS.checkDelayAfterReturn / 1000} секунд`);
            console.log(`   • При ошибке "Упс!": пауза ${SETTINGS.retryDelay / 1000} секунд\n`);
            
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились, обновляю страницу...');
                    setTimeout(() => location.reload(), 2000);
                    break;
                }
            }
            
            running = false;
            updateUI();
            console.log(`\n🏁 БОТ ОСТАНОВЛЕН | Выполнено: ${stats.completed} | Заработано: ${stats.earned.toFixed(2)}`);
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            if (autoStartTimer) clearTimeout(autoStartTimer);
            console.log('🛑 Бот остановлен');
            updateUI();
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 Статистика сброшена');
        }
        
        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        
        window.botStats = () => console.log(`✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        
        updateUI();
        
        // Автозапуск
        autoStartTimer = setTimeout(() => {
            if (!running) startBot();
        }, SETTINGS.autoStartDelay);
        
        console.log('✅ Бот готов! botStats() - статистика');
    }
})();
