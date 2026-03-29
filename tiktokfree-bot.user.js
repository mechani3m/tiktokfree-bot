// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.3.0
// @description  Полная версия: быстрое закрытие, правильное скрытие, пауза 5 сек при ошибке
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
        waitBeforeCloseFound: 15000,
        waitBeforeCloseNotFound: 1000,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 1500,
        retryDelay: 5000  // 5 секунд пауза перед повторной проверкой при ошибке "Упс!"
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';
        
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
                }
            });
        }
        
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
                        if (btn && btn.offsetParent !== null) return btn;
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('подписаться') || text.includes('follow')) return btn;
                }
                
                if (attempt < 5) await delay(500);
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
            
            for (let attempt = 0; attempt < 6; attempt++) {
                for (const selector of selectors) {
                    try {
                        const btn = document.querySelector(selector);
                        if (btn && btn.offsetParent !== null) return btn;
                    } catch(e) {}
                }
                
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('нравится') || text.includes('like')) return btn;
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
            
            if (button) {
                console.log(`✅ Кнопка ${taskType} найдена!`);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                localStorage.removeItem('hide_current_task');
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #0a0; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `✅ Кнопка ${taskType} найдена!`;
                document.body.appendChild(indicator);
                
                setTimeout(() => {
                    console.log('🔚 Закрываю вкладку');
                    window.close();
                }, SETTINGS.waitBeforeCloseFound);
                
            } else {
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА!`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                
                localStorage.setItem('hide_current_task', 'true');
                localStorage.setItem('hide_task_reason', `button_${taskType}_not_found`);
                console.log('⚠️ Установлен флаг hide_current_task = true');
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #a00; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `❌ Кнопка ${taskType} НЕ найдена!`;
                document.body.appendChild(indicator);
                
                setTimeout(() => {
                    console.log('🔚 Быстро закрываю вкладку');
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
        
        // ПРАВИЛЬНАЯ ФУНКЦИЯ СКРЫТИЯ (работает!)
        function hideCurrentTask() {
            console.log('🗑 Скрываю задание...');
            
            const task = document.querySelector('.task-item--wrapper');
            if (!task) {
                console.log('❌ Нет заданий');
                return false;
            }
            
            const hideBtn = task.querySelector('.btn--close');
            if (hideBtn) {
                hideBtn.click();
                console.log('✅ Задание скрыто через .btn--close');
                return true;
            }
            
            const altBtn = task.querySelector('button[value="hide"]');
            if (altBtn) {
                altBtn.click();
                console.log('✅ Задание скрыто через button[value="hide"]');
                return true;
            }
            
            console.log('❌ Не удалось скрыть задание');
            return false;
        }
        
        function checkAndHandleHideFlag() {
            const needHide = localStorage.getItem('hide_current_task');
            if (needHide === 'true') {
                const reason = localStorage.getItem('hide_task_reason');
                console.log(`⚠️ Флаг скрытия найден! Причина: ${reason}`);
                
                localStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_task_reason');
                
                const hidden = hideCurrentTask();
                if (hidden) {
                    console.log('✅ Задание скрыто');
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
                    console.log('❌ Повторная ошибка, скрываю задание');
                    hideCurrentTask();
                    retryCount = 0;
                    return false;
                } else {
                    console.log(`🔄 Пауза ${SETTINGS.retryDelay / 1000} сек, затем повторная проверка...`);
                    retryCount++;
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheckAndWait(task, true);
                }
            } else {
                console.log('❌ Тост не появился');
                return false;
            }
        }
        
        function waitForReturn(task) {
            if (checkInterval) clearInterval(checkInterval);
            
            return new Promise((resolve) => {
                let resolved = false;
                let handled = false;
                
                checkInterval = setInterval(() => {
                    if (!document.hidden && !resolved && !handled) {
                        resolved = true;
                        clearInterval(checkInterval);
                        console.log('👀 Возврат на сайт!');
                        
                        const wasHidden = checkAndHandleHideFlag();
                        if (wasHidden) {
                            console.log('✅ Задание скрыто - проверка НЕ ВЫПОЛНЯЛАСЬ');
                            handled = true;
                            resolve(false);
                            return;
                        }
                        
                        console.log(`⏳ Пауза ${SETTINGS.checkDelayAfterReturn / 1000} сек...`);
                        setTimeout(async () => {
                            const wasHiddenAgain = checkAndHandleHideFlag();
                            if (wasHiddenAgain) {
                                resolve(false);
                                return;
                            }
                            
                            const success = await clickCheckAndWait(task, false);
                            resolve(success);
                        }, SETTINGS.checkDelayAfterReturn);
                    }
                }, 200);
                
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
                console.log('📌 Настройки:');
                console.log('   • При ошибке "Упс!" → пауза 5 сек → повторная проверка');
                console.log('   • Если кнопка не найдена → быстрое закрытие → скрытие задания\n');
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
        console.log('💡 Команды: botStats() - статистика, resetStats() - сброс');
    }
    
})();
