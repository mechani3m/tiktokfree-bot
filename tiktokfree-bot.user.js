// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.2.0
// @description  Быстрое закрытие при ненайденной кнопке + гарантированное скрытие
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
        waitBeforeCloseFound: 15000,    // 15 секунд если кнопка найдена
        waitBeforeCloseNotFound: 1000,   // 1 секунда если кнопка НЕ найдена
        autoStartDelay: 5000,
        checkDelayAfterReturn: 1500
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';
        
        let buttonFound = false;
        let searchCompleted = false;
        
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        function sendWebhook(action, data) {
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
                },
                onerror: function(err) {
                    console.log(`⚠️ Ошибка отправки вебхука:`, err);
                }
            });
        }
        
        // Поиск кнопки подписки
        async function findFollowButton() {
            const selectors = [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]',
                'div[data-e2e="follow-button"] button'
            ];
            
            for (let attempt = 0; attempt < 6; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            return btn;
                        }
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('подписаться') || text.includes('follow')) {
                        return btn;
                    }
                }
                
                if (attempt < 5) await delay(500);
            }
            return null;
        }
        
        // Поиск кнопки лайка
        async function findLikeButton() {
            const selectors = [
                '[data-e2e="like-button"]',
                'button[aria-label*="Нравится"]',
                'button[aria-label*="Like"]',
                'span[data-e2e="like-icon"]',
                '[data-e2e*="like"]'
            ];
            
            for (let attempt = 0; attempt < 6; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) {
                            return btn;
                        }
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('нравится') || text.includes('like')) {
                        return btn;
                    }
                }
                
                if (attempt < 5) await delay(500);
            }
            return null;
        }
        
        async function run() {
            console.log('🔍 Быстрый поиск кнопки...');
            
            let button = null;
            
            if (taskType === 'follow') {
                button = await findFollowButton();
            } else {
                button = await findLikeButton();
            }
            
            searchCompleted = true;
            
            if (button) {
                buttonFound = true;
                console.log(`✅ Кнопка ${taskType} найдена!`);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                
                // Сохраняем что кнопка найдена
                localStorage.setItem('tikbot_button_found', 'true');
                localStorage.setItem('tikbot_button_type', taskType);
                localStorage.removeItem('hide_current_task'); // Удаляем флаг скрытия если был
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #0a0; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `✅ Кнопка ${taskType} найдена! Закрытие через ${SETTINGS.waitBeforeCloseFound/1000} сек`;
                document.body.appendChild(indicator);
                
                // Ждем положенное время и закрываем
                setTimeout(() => {
                    console.log('🔚 Закрываю вкладку (кнопка найдена)');
                    window.close();
                }, SETTINGS.waitBeforeCloseFound);
                
            } else {
                buttonFound = false;
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА!`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                
                // КЛЮЧЕВОЕ: СОХРАНЯЕМ ФЛАГ СКРЫТИЯ
                localStorage.setItem('hide_current_task', 'true');
                localStorage.setItem('hide_task_reason', `button_${taskType}_not_found`);
                localStorage.setItem('hide_task_timestamp', Date.now());
                console.log('⚠️ Установлен флаг hide_current_task = true');
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #a00; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `❌ Кнопка ${taskType} НЕ найдена! Закрытие через ${SETTINGS.waitBeforeCloseNotFound/1000} сек`;
                document.body.appendChild(indicator);
                
                // БЫСТРОЕ ЗАКРЫТИЕ (1 секунда)
                setTimeout(() => {
                    console.log('🔚 Быстро закрываю вкладку (кнопка не найдена)');
                    window.close();
                }, SETTINGS.waitBeforeCloseNotFound);
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
        
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
        let retryCount = 0;
        const MAX_RETRY = 2;
        
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) {
            stats = savedStats;
            console.log('📊 Загружена статистика:', stats);
        }
        
        const wasRunning = GM_getValue('botWasRunning', false);
        if (wasRunning) {
            console.log('🔄 Бот был запущен до обновления');
            GM_deleteValue('botWasRunning');
        }
        
        function saveStats() {
            GM_setValue('botStats', stats);
        }
        
        function getTaskType() {
            const titleEl = document.querySelector('.list-item--title.task-item--title');
            if (!titleEl) return null;
            
            const titleText = titleEl.innerText || titleEl.textContent;
            
            if (titleText.includes('Подписаться')) {
                return { type: 'follow', name: 'Подписка' };
            } else if (titleText.includes('лайк') || titleText.includes('Like')) {
                return { type: 'like', name: 'Лайк' };
            }
            return null;
        }
        
        function hideCurrentTask() {
            console.log('🗑 Скрываю задание...');
            
            // Пробуем разные способы скрыть задание
            const closeBtn = document.querySelector('.btn--close');
            if (closeBtn) {
                closeBtn.click();
                console.log('✅ Задание скрыто через btn--close');
                return true;
            }
            
            // Ищем кнопку с крестиком
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
                if (btn.innerText === '×' || btn.innerText === '✕') {
                    btn.click();
                    console.log('✅ Задание скрыто через кнопку ×');
                    return true;
                }
            }
            
            // Пробуем найти форму и отправить hide
            const form = document.querySelector('form[name="UserPerformTask"]');
            if (form) {
                const hideBtn = form.querySelector('button[value="hide"]');
                if (hideBtn) {
                    hideBtn.click();
                    console.log('✅ Задание скрыто через кнопку hide');
                    return true;
                }
            }
            
            console.log('❌ Не удалось скрыть задание');
            return false;
        }
        
        // Функция проверки флага скрытия - вызывается везде где можно
        function checkAndHandleHideFlag() {
            const needHide = localStorage.getItem('hide_current_task');
            if (needHide === 'true') {
                const reason = localStorage.getItem('hide_task_reason');
                console.log(`⚠️ НАЙДЕН ФЛАГ СКРЫТИЯ! Причина: ${reason}`);
                
                // Очищаем флаг
                localStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_task_reason');
                localStorage.removeItem('hide_task_timestamp');
                
                // Скрываем задание
                const hidden = hideCurrentTask();
                
                if (hidden) {
                    console.log('✅ Задание УСПЕШНО СКРЫТО');
                } else {
                    console.log('⚠️ Не удалось скрыть задание');
                    // Пробуем еще раз через 500мс
                    setTimeout(() => hideCurrentTask(), 500);
                }
                
                return true;
            }
            return false;
        }
        
        function waitForToast(timeout = 15000) {
            return new Promise((resolve) => {
                const existingToasts = document.querySelectorAll('.toast');
                for (const toast of existingToasts) {
                    const text = toast.innerText || toast.textContent;
                    if (text.includes('успешно') || text.includes('зачислено')) {
                        resolve({ success: true, error: false, text: text });
                        return;
                    }
                    if (text.includes('Упс') || text.includes('не выполнили')) {
                        resolve({ success: false, error: true, text: text });
                        return;
                    }
                }
                
                let observer = null;
                let timeoutId = null;
                
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && node.classList && node.classList.contains('toast')) {
                                const text = node.innerText || node.textContent;
                                if (text.includes('успешно') || text.includes('зачислено')) {
                                    if (observer) observer.disconnect();
                                    if (timeoutId) clearTimeout(timeoutId);
                                    resolve({ success: true, error: false, text: text });
                                    return;
                                }
                                if (text.includes('Упс') || text.includes('не выполнили')) {
                                    if (observer) observer.disconnect();
                                    if (timeoutId) clearTimeout(timeoutId);
                                    resolve({ success: false, error: true, text: text });
                                    return;
                                }
                            }
                        }
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });
                
                timeoutId = setTimeout(() => {
                    if (observer) observer.disconnect();
                    resolve({ success: false, error: false, text: null });
                }, timeout);
            });
        }
        
        async function clickCheckAndWait(task, isRetry = false) {
            console.log(`🔍 Проверка (${isRetry ? 'повторная' : 'первая'})...`);
            
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) {
                console.log('❌ Кнопка "Проверить" не найдена');
                return false;
            }
            
            checkBtn.click();
            console.log('🔘 "Проверить" нажата');
            
            const toastResult = await waitForToast(15000);
            
            if (toastResult.success) {
                console.log(`✅ ВЫПОЛНЕНО! +${task.reward} монет`);
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
                    console.log('❌ Повторная ошибка, скрываю');
                    hideCurrentTask();
                    retryCount = 0;
                    return false;
                } else {
                    console.log('🔄 Повторная проверка через 2 сек...');
                    retryCount++;
                    await new Promise(r => setTimeout(r, 2000));
                    return await clickCheckAndWait(task, true);
                }
            } else {
                console.log('❌ Тост не появился');
                return false;
            }
        }
        
        // Ждем возврата
        function waitForReturn(task) {
            if (checkInterval) clearInterval(checkInterval);
            
            return new Promise((resolve) => {
                let resolved = false;
                
                // Флаг для предотвращения двойной обработки
                let handled = false;
                
                checkInterval = setInterval(() => {
                    if (!document.hidden && !resolved && !handled) {
                        resolved = true;
                        clearInterval(checkInterval);
                        console.log('👀 Возврат на сайт!');
                        
                        // ПЕРВОЕ ДЕЛО: ПРОВЕРЯЕМ ФЛАГ СКРЫТИЯ
                        const wasHidden = checkAndHandleHideFlag();
                        if (wasHidden) {
                            console.log('✅ Задание СКРЫТО (кнопка не найдена) - проверка НЕ ВЫПОЛНЯЛАСЬ');
                            handled = true;
                            resolve(false);
                            return;
                        }
                        
                        // Если флага нет, делаем паузу и проверяем
                        console.log(`⏳ Пауза ${SETTINGS.checkDelayAfterReturn / 1000} сек...`);
                        setTimeout(async () => {
                            // Еще раз проверяем флаг перед проверкой
                            const wasHiddenAgain = checkAndHandleHideFlag();
                            if (wasHiddenAgain) {
                                console.log('✅ Задание СКРЫТО (флаг найден перед проверкой)');
                                resolve(false);
                                return;
                            }
                            
                            const success = await clickCheckAndWait(task, false);
                            resolve(success);
                        }, SETTINGS.checkDelayAfterReturn);
                    }
                }, 200); // Частая проверка каждые 200мс
                
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
            <div id="task-type-display" style="font-size: 10px;">📋 Тип: ожидание</div>
            <hr>
            <div style="font-size: 10px;" id="auto-status">⏳ Автозапуск...</div>
            <button id="start-btn" style="margin-top: 8px; width: 100%; padding: 6px; background: #4caf50; border: none; border-radius: 6px; cursor: pointer; color: white;">▶ СТАРТ</button>
            <button id="stop-btn" style="margin-top: 4px; width: 100%; padding: 6px; background: #f44336; border: none; border-radius: 6px; cursor: pointer; color: white;">⏹ СТОП</button>
            <button id="reset-stats" style="margin-top: 4px; width: 100%; padding: 4px; background: #ff9800; border: none; border-radius: 6px; cursor: pointer; font-size: 10px; color: white;">🔄 Сбросить статистику</button>
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
            }
        }
        
        function updateAutoStatus(text) {
            const el = document.getElementById('auto-status');
            if (el) el.innerHTML = text;
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
            localStorage.setItem('current_task_type', taskType?.type || 'follow');
            const separator = url.includes('?') ? '&' : '?';
            window.open(`${url}${separator}task_type=${taskType?.type || 'follow'}`, '_blank');
        }
        
        async function doTask() {
            // ПРОВЕРЯЕМ ФЛАГ ПЕРЕД НАЧАЛОМ
            const wasHidden = checkAndHandleHideFlag();
            if (wasHidden) {
                console.log('⚠️ Был флаг скрытия, пропускаем задание');
                return false;
            }
            
            const task = getTask();
            if (!task) {
                console.log('❌ Нет заданий');
                return false;
            }
            
            if (!task.taskType) {
                console.log('❌ Не удалось определить тип');
                return false;
            }
            
            console.log(`\n🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            
            const success = await waitForReturn(task);
            return success;
        }
        
        async function startBot(showMessage = true) {
            if (running) return;
            running = true;
            updateUI();
            
            if (showMessage) {
                console.log('\n🚀 БОТ ЗАПУЩЕН');
                console.log('📌 Если кнопка НЕ найдена:');
                console.log('   • Быстрое закрытие (1 секунда)');
                console.log('   • Установка флага скрытия');
                console.log('   • При возврате → СКРЫТИЕ задания без проверки\n');
            }
            
            let count = 0;
            while (running && count < 100) {
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
            console.log(`\n🏁 ОСТАНОВЛЕН | Выполнено: ${stats.completed} | Заработано: ${stats.earned.toFixed(2)}`);
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            if (autoStartTimer) clearTimeout(autoStartTimer);
            console.log('🛑 Остановлен');
            updateUI();
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 Статистика сброшена');
        }
        
        function showStats() {
            console.log(`\n📊 ✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
            updateUI();
        }
        
        function scheduleAutoStart() {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            let secondsLeft = SETTINGS.autoStartDelay / 1000;
            updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек...`);
            
            const countdown = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0 && !running) updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек...`);
                if (secondsLeft <= 0 || running) clearInterval(countdown);
            }, 1000);
            
            autoStartTimer = setTimeout(() => {
                if (!running) startBot(true);
            }, SETTINGS.autoStartDelay);
        }
        
        document.getElementById('start-btn').onclick = () => {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            startBot(true);
        };
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        
        window.botStats = showStats;
        window.resetStats = resetStats;
        
        updateUI();
        scheduleAutoStart();
        
        console.log('✅ Бот готов!');
        console.log('⚠️ Если кнопка не найдена → закрытие через 1 сек → скрытие задания');
    }
    
})();
