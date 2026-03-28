// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.0.0
// @description  Оптимизированный бот: быстрая отправка вебхука, мгновенная проверка
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
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    const isTikTok = location.hostname.includes('tiktok.com');
    const isTikTopFree = location.hostname.includes('tiktop-free.com');
    
    // ========== НАСТРОЙКИ ==========
    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        waitBeforeClose: 15000,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 2000  // Пауза после закрытия вкладки перед проверкой
    };
    
    // ========== TIKTOK - БЫСТРЫЙ ПОИСК КНОПКИ ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен (быстрый режим)');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';
        
        let webhookSent = false;
        let buttonFound = false;
        
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // Функция отправки вебхука с подтверждением
        function sendWebhookWithConfirm(action, data) {
            return new Promise((resolve) => {
                const url = SETTINGS.webhookUrl + action;
                console.log(`📡 Отправка вебхука: ${action}`);
                
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        timestamp: Date.now(),
                        url: location.href,
                        taskType: taskType,
                        ...data
                    }),
                    onload: function(res) {
                        console.log(`✅ Вебхук ${action} отправлен, статус: ${res.status}`);
                        resolve(true);
                    },
                    onerror: function(err) {
                        console.log(`⚠️ Ошибка отправки вебхука ${action}:`, err);
                        resolve(false);
                    },
                    ontimeout: function() {
                        console.log(`⏰ Таймаут отправки вебхука ${action}`);
                        resolve(false);
                    }
                });
            });
        }
        
        // Быстрый поиск кнопки подписки
        async function quickFindFollowButton() {
            const selectors = [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]',
                'div[data-e2e="follow-button"] button'
            ];
            
            for (let attempt = 0; attempt < 10; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            console.log(`✅ Кнопка подписки найдена на ${attempt + 1} попытке!`);
                            return btn;
                        }
                    } catch(e) {}
                }
                
                // Быстрый поиск по тексту
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('подписаться') || text.includes('follow')) {
                        console.log(`✅ Кнопка подписки найдена по тексту на ${attempt + 1} попытке!`);
                        return btn;
                    }
                }
                
                if (attempt < 9) {
                    await delay(300); // Быстрая проверка каждые 300мс
                }
            }
            return null;
        }
        
        // Быстрый поиск кнопки лайка
        async function quickFindLikeButton() {
            const selectors = [
                '[data-e2e="like-button"]',
                'button[aria-label*="Нравится"]',
                'button[aria-label*="Like"]',
                'span[data-e2e="like-icon"]',
                '[data-e2e*="like"]'
            ];
            
            for (let attempt = 0; attempt < 10; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            console.log(`✅ Кнопка лайка найдена на ${attempt + 1} попытке!`);
                            return btn;
                        }
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('нравится') || text.includes('like')) {
                        console.log(`✅ Кнопка лайка найдена по тексту на ${attempt + 1} попытке!`);
                        return btn;
                    }
                }
                
                if (attempt < 9) {
                    await delay(300);
                }
            }
            return null;
        }
        
        // Основная функция - быстрый поиск и отправка
        async function quickSearchAndSend() {
            console.log('🔍 Быстрый поиск кнопки...');
            
            let button = null;
            let action = taskType;
            
            if (taskType === 'follow') {
                button = await quickFindFollowButton();
            } else if (taskType === 'like') {
                button = await quickFindLikeButton();
            }
            
            if (button) {
                buttonFound = true;
                console.log(`🎯 Кнопка ${action} найдена! Текст: ${button.innerText}`);
                
                // Отправляем вебхук с подтверждением
                const sent = await sendWebhookWithConfirm(`/${action}`, {
                    buttonText: button.innerText,
                    buttonFound: true,
                    quickMode: true,
                    searchTime: 'fast'
                });
                
                if (sent) {
                    webhookSent = true;
                    console.log(`✅ Вебхук /${action} успешно отправлен и подтвержден`);
                    
                    // Показываем индикатор
                    const indicator = document.createElement('div');
                    indicator.style.cssText = `
                        position: fixed;
                        bottom: 10px;
                        left: 10px;
                        z-index: 9999;
                        background: rgba(0,100,0,0.9);
                        color: #00ff00;
                        padding: 6px 12px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: bold;
                        font-family: monospace;
                    `;
                    indicator.innerHTML = `🤖 ✅ Вебхук ${action} отправлен!`;
                    document.body.appendChild(indicator);
                    setTimeout(() => indicator.remove(), 3000);
                } else {
                    console.log(`⚠️ Вебхук /${action} не подтвержден, но продолжаем`);
                }
                
                // Сохраняем что кнопка найдена
                localStorage.setItem('tikbot_button_found', 'true');
                localStorage.setItem('tikbot_button_type', action);
                
            } else {
                buttonFound = false;
                console.log(`❌ Кнопка ${action} не найдена за 3 секунды`);
                
                // Отправляем вебхук о том что кнопка не найдена
                await sendWebhookWithConfirm(`/${action}_not_found`, {
                    buttonFound: false,
                    quickMode: true
                });
                
                // Сохраняем что нужно скрыть задание
                localStorage.setItem('hide_current_task', 'true');
                localStorage.setItem('hide_task_reason', `button_${action}_not_found_quick`);
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    z-index: 9999;
                    background: rgba(100,0,0,0.9);
                    color: #ff6666;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: bold;
                    font-family: monospace;
                `;
                indicator.innerHTML = `🤖 ❌ Кнопка ${action} НЕ найдена`;
                document.body.appendChild(indicator);
                setTimeout(() => indicator.remove(), 3000);
            }
            
            // Ждем и закрываем вкладку
            console.log(`⏳ Ждем ${SETTINGS.waitBeforeClose / 1000} секунд и закрываем...`);
            setTimeout(() => {
                console.log('🔚 Закрываю вкладку');
                window.close();
            }, SETTINGS.waitBeforeClose);
        }
        
        // Запускаем быстрый поиск сразу после загрузки DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', quickSearchAndSend);
        } else {
            quickSearchAndSend();
        }
        
        return;
    }
    
    // ========== TIKTOPFREE ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot запущен (оптимизированный)');
        
        let running = false;
        let autoStartTimer = null;
        let stats = {
            completed: 0,
            earned: 0
        };
        let checkInterval = null;
        let retryCount = 0;
        const MAX_RETRY = 2;
        
        // Загружаем сохраненную статистику
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) {
            stats = savedStats;
            console.log('📊 Загружена сохраненная статистика:', stats);
        }
        
        const wasRunning = GM_getValue('botWasRunning', false);
        if (wasRunning) {
            console.log('🔄 Бот был запущен до обновления страницы');
            GM_deleteValue('botWasRunning');
        }
        
        function saveStats() {
            GM_setValue('botStats', stats);
        }
        
        function getTaskType() {
            const titleEl = document.querySelector('.list-item--title.task-item--title');
            if (!titleEl) return null;
            
            const titleText = titleEl.innerText || titleEl.textContent;
            console.log('📝 Заголовок задания:', titleText);
            
            if (titleText.includes('Подписаться')) {
                return { type: 'follow', action: 'follow', webhook: '/follow', name: 'Подписка' };
            } else if (titleText.includes('лайк') || titleText.includes('Like')) {
                return { type: 'like', action: 'like', webhook: '/like', name: 'Лайк' };
            }
            return null;
        }
        
        function hideCurrentTask() {
            console.log('🗑 Скрываю задание...');
            
            const closeBtn = document.querySelector('.btn--close');
            if (closeBtn) {
                closeBtn.click();
                console.log('✅ Задание скрыто');
                return true;
            }
            
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
                if (btn.innerText === '×' || btn.innerText === '✕' || btn.innerText.includes('Скрыть')) {
                    btn.click();
                    console.log('✅ Задание скрыто');
                    return true;
                }
            }
            
            console.log('❌ Не удалось скрыть задание');
            return false;
        }
        
        // Функция ожидания появления тост-уведомления
        function waitForToast(timeout = 15000) {
            return new Promise((resolve) => {
                console.log('👀 Ожидаю тост-уведомление...');
                
                const existingToasts = document.querySelectorAll('.toast');
                for (const toast of existingToasts) {
                    const text = toast.innerText || toast.textContent;
                    if (text.includes('успешно') || text.includes('зачислено') || text.includes('Выполнили')) {
                        console.log('✅ Тост успеха:', text);
                        resolve({ success: true, error: false, text: text });
                        return;
                    }
                    if (text.includes('Упс') || text.includes('не выполнили')) {
                        console.log('⚠️ Тост ошибки:', text);
                        resolve({ success: false, error: true, text: text });
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
                                        console.log('✅ Тост успеха:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: true, error: false, text: text });
                                        return;
                                    }
                                    if (text.includes('Упс') || text.includes('не выполнили')) {
                                        console.log('⚠️ Тост ошибки:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: false, error: true, text: text });
                                        return;
                                    }
                                }
                                const toast = node.querySelector?.('.toast');
                                if (toast) {
                                    const text = toast.innerText;
                                    if (text.includes('успешно') || text.includes('зачислено')) {
                                        console.log('✅ Тост успеха:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: true, error: false, text: text });
                                        return;
                                    }
                                    if (text.includes('Упс') || text.includes('не выполнили')) {
                                        console.log('⚠️ Тост ошибки:', text);
                                        if (observer) observer.disconnect();
                                        if (timeoutId) clearTimeout(timeoutId);
                                        resolve({ success: false, error: true, text: text });
                                        return;
                                    }
                                }
                            }
                        }
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });
                
                timeoutId = setTimeout(() => {
                    console.log('⏰ Таймаут: тост не появился');
                    if (observer) observer.disconnect();
                    resolve({ success: false, error: false, text: null });
                }, timeout);
            });
        }
        
        // Нажать кнопку "Проверить" и ждать тост
        async function clickCheckAndWait(task, isRetry = false) {
            console.log(`🔍 Проверка задания (попытка ${isRetry ? 'повторная' : 'первая'})...`);
            
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
                    text: `+${task.reward} монет. Всего: ${stats.completed}`,
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
                
                retryCount = 0;
                return true;
                
            } else if (toastResult.error) {
                console.log(`⚠️ Ошибка: ${toastResult.text}`);
                
                if (isRetry) {
                    console.log('❌ Повторная ошибка, скрываю задание');
                    GM_notification({
                        title: '❌ Задание не выполнено',
                        text: `После ${MAX_RETRY} попыток задание скрыто`,
                        timeout: 3000
                    });
                    hideCurrentTask();
                    retryCount = 0;
                    return false;
                } else {
                    console.log('🔄 Повторная проверка через 2 секунды...');
                    retryCount++;
                    await new Promise(r => setTimeout(r, 2000));
                    const retryResult = await clickCheckAndWait(task, true);
                    return retryResult;
                }
            } else {
                console.log('❌ Тост не появился');
                return false;
            }
        }
        
        // Ждем возврата на сайт (с паузой перед проверкой)
        function waitForReturn(task) {
            if (checkInterval) clearInterval(checkInterval);
            
            return new Promise((resolve) => {
                let resolved = false;
                
                checkInterval = setInterval(async () => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(checkInterval);
                        console.log('👀 Возврат на сайт!');
                        
                        // Проверяем флаг скрытия
                        const needHide = localStorage.getItem('hide_current_task');
                        if (needHide === 'true') {
                            const reason = localStorage.getItem('hide_task_reason');
                            console.log(`⚠️ Задание нужно скрыть. Причина: ${reason}`);
                            localStorage.removeItem('hide_current_task');
                            localStorage.removeItem('hide_task_reason');
                            hideCurrentTask();
                            resolve(false);
                            return;
                        }
                        
                        // Пауза перед проверкой
                        console.log(`⏳ Пауза ${SETTINGS.checkDelayAfterReturn / 1000} сек перед проверкой...`);
                        await new Promise(r => setTimeout(r, SETTINGS.checkDelayAfterReturn));
                        
                        const success = await clickCheckAndWait(task, false);
                        resolve(success);
                    }
                }, 500);
                
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(checkInterval);
                        console.log('⏰ Таймаут ожидания возврата');
                        resolve(false);
                    }
                }, 60000);
            });
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
            min-width: 240px;
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
            <div id="task-type-display" style="font-size: 10px; margin-top: 4px;">📋 Тип: ожидание</div>
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
            
            const taskType = getTaskType();
            if (taskType) {
                const typeText = taskType.type === 'follow' ? '📌 Подписка' : '❤️ Лайк';
                document.getElementById('task-type-display').innerHTML = typeText;
                document.getElementById('task-type-display').style.color = taskType.type === 'follow' ? '#aaffaa' : '#ffaaaa';
            } else {
                document.getElementById('task-type-display').innerHTML = '📋 Нет заданий';
            }
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
            
            const taskType = getTaskType();
            
            return { wrapper, id, execId, nonce, reward, executeUrl, taskType };
        }
        
        function clickExecute(url, taskType) {
            console.log(`🔘 Открываю TikTok (${taskType?.name || 'unknown'})`);
            
            localStorage.setItem('current_task_type', taskType?.type || 'follow');
            
            const separator = url.includes('?') ? '&' : '?';
            const urlWithType = `${url}${separator}task_type=${taskType?.type || 'follow'}`;
            
            window.open(urlWithType, '_blank');
        }
        
        async function doTask() {
            const pendingHide = localStorage.getItem('hide_current_task');
            if (pendingHide === 'true') {
                console.log('⚠️ Есть ожидающее скрытие, пропускаем...');
                localStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_task_reason');
                hideCurrentTask();
                return false;
            }
            
            const task = getTask();
            if (!task) {
                console.log('❌ Нет заданий');
                return false;
            }
            
            if (!task.taskType) {
                console.log('❌ Не удалось определить тип задания');
                return false;
            }
            
            const typeName = task.taskType.type === 'follow' ? '📌 ПОДПИСКА' : '❤️ ЛАЙК';
            console.log(`\n🎯 НОВОЕ ЗАДАНИЕ | ${typeName} | +${task.reward} монет`);
            
            clickExecute(task.executeUrl, task.taskType);
            
            const success = await waitForReturn(task);
            
            if (success) {
                console.log(`📊 Прогресс: ${stats.completed} заданий, ${stats.earned.toFixed(2)} монет`);
            }
            
            return success;
        }
        
        async function startBot(showMessage = true) {
            if (running) return;
            
            running = true;
            updateUI();
            
            if (showMessage) {
                console.log('\n🚀 БОТ ЗАПУЩЕН (оптимизированный)');
                console.log('📌 Быстрый режим:');
                console.log('   • Поиск кнопки в TikTok каждые 300мс');
                console.log('   • Вебхук отправляется сразу при нахождении');
                console.log('   • Проверка отправки вебхука');
                console.log('   • После закрытия вкладки → пауза 2 сек → проверка\n');
            }
            
            let count = 0;
            const MAX_TASKS = 100;
            
            while (running && count < MAX_TASKS) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 1500));
                
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились, обновляю...');
                    GM_setValue('botWasRunning', true);
                    setTimeout(() => location.reload(), 2000);
                    break;
                }
            }
            
            running = false;
            updateUI();
            console.log(`\n🏁 БОТ ОСТАНОВЛЕН | Выполнено: ${stats.completed} | Заработано: ${stats.earned.toFixed(2)}`);
            GM_notification({
                title: '🏁 Бот остановлен',
                text: `Выполнено: ${stats.completed}, Заработано: ${stats.earned.toFixed(2)}`,
                timeout: 5000
            });
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            if (autoStartTimer) clearTimeout(autoStartTimer);
            updateAutoStatus('⏹ Остановлен');
            console.log('🛑 Бот остановлен');
            updateUI();
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 Статистика сброшена');
        }
        
        function showStats() {
            console.log(`\n📊 СТАТИСТИКА: ✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
            updateUI();
        }
        
        function scheduleAutoStart() {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            
            let secondsLeft = SETTINGS.autoStartDelay / 1000;
            updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек...`);
            
            const countdown = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0 && !running) {
                    updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек...`);
                }
                if (secondsLeft <= 0 || running) clearInterval(countdown);
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
            updateAutoStatus('▶ Запуск...');
            startBot(true);
        };
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        
        window.botStats = showStats;
        window.resetStats = resetStats;
        
        updateUI();
        scheduleAutoStart();
        
        console.log('✅ Бот готов! Команды: botStats() - статистика');
    }
    
})();
