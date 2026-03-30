// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      8.0.0
// @description  Исправлены селекторы для кнопки лайка (актуальная структура TikTok)
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
        waitAfterFound: 15000,
        waitAfterNotFound: 3000,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 2000,
        retryDelay: 5000,
        searchAttempts: 10,
        searchInterval: 500,
        webhookTimeout: 10000,
        webhookMaxRetries: 3,
        hideFlagTimeout: 5000
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot v8.0 запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || GM_getValue('current_task_type', 'follow');
        
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        function sendWebhook(action, payload = {}, attempt = 1) {
            const url = SETTINGS.webhookUrl + action;
            
            const data = {
                timestamp: Date.now(),
                url: location.href,
                taskType: taskType,
                ...payload
            };
            
            console.log(`📡 Отправка вебхука: ${action} (попытка ${attempt}/${SETTINGS.webhookMaxRetries})`);
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                timeout: SETTINGS.webhookTimeout,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(data),
                
                onload: function(res) {
                    if (res.status >= 200 && res.status < 300) {
                        console.log(`✅ Вебхук ${action} успешно отправлен, статус: ${res.status}`);
                    } else {
                        console.log(`⚠️ Вебхук ${action} вернул ошибку, статус: ${res.status}`);
                        retry();
                    }
                },
                
                onerror: function(e) {
                    console.log(`❌ Ошибка отправки вебхука ${action}:`, e);
                    retry();
                },
                
                ontimeout: function() {
                    console.log(`⏳ Таймаут отправки вебхука ${action}`);
                    retry();
                }
            });
            
            function retry() {
                if (attempt < SETTINGS.webhookMaxRetries) {
                    const delayMs = 2000 * attempt;
                    console.log(`🔁 Повторная отправка через ${delayMs/1000} сек (попытка ${attempt + 1})`);
                    setTimeout(() => {
                        sendWebhook(action, payload, attempt + 1);
                    }, delayMs);
                } else {
                    console.log(`❌ Вебхук ${action} не отправлен после ${SETTINGS.webhookMaxRetries} попыток`);
                }
            }
        }
        
        function sendHideStatus() {
            console.log('📡 Отправка статуса скрытия через GM_setValue');
            GM_setValue('hide_current_task', 'true');
            GM_setValue('hide_task_reason', `button_${taskType}_not_found`);
        }
        
        async function findFollowButton() {
            const selectors = [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]'
            ];
            
            for (let attempt = 0; attempt < SETTINGS.searchAttempts; attempt++) {
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
                
                if (attempt < SETTINGS.searchAttempts - 1) await delay(SETTINGS.searchInterval);
            }
            return null;
        }
        
        // ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОИСКА ЛАЙКА (чистая)
        async function findLikeButton() {
            const selector = '[data-e2e="play-side-like"] a';
            
            for (let attempt = 0; attempt < SETTINGS.searchAttempts; attempt++) {
                try {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) {
                        console.log(`✅ Кнопка лайка найдена по селектору: ${selector}`);
                        return element;
                    }
                } catch(e) {}
                
                if (attempt < SETTINGS.searchAttempts - 1) {
                    await delay(SETTINGS.searchInterval);
                }
            }
            return null;
        }
        
        async function run() {
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
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #0a0; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px;`;
                indicator.innerHTML = `✅ Кнопка найдена! Ждем ${SETTINGS.waitAfterFound / 1000} сек`;
                document.body.appendChild(indicator);
                
                setTimeout(() => window.close(), SETTINGS.waitAfterFound);
                
            } else {
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                sendHideStatus();
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #a00; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px;`;
                indicator.innerHTML = `❌ Кнопка НЕ найдена! Ждем ${SETTINGS.waitAfterNotFound / 1000} сек`;
                document.body.appendChild(indicator);
                
                setTimeout(() => window.close(), SETTINGS.waitAfterNotFound);
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
        console.log('🤖 TikTokFree Bot v8.0 запущен');
        
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
        
        function dismissToast(toast) {
            if (!toast || !document.body.contains(toast)) return;
            
            const closeBtn = toast.querySelector('.toast-close, .close, [aria-label="Close"], button');
            if (closeBtn) {
                closeBtn.click();
                return;
            }
            
            try {
                const rect = toast.getBoundingClientRect();
                const startX = rect.left + rect.width / 2;
                const startY = rect.top + rect.height / 2;
                
                const touchStart = new TouchEvent('touchstart', {
                    touches: [new Touch({ identifier: Date.now(), target: toast, clientX: startX, clientY: startY })]
                });
                const touchEnd = new TouchEvent('touchend', {
                    changedTouches: [new Touch({ identifier: Date.now(), target: toast, clientX: startX + 200, clientY: startY })]
                });
                
                toast.dispatchEvent(touchStart);
                setTimeout(() => toast.dispatchEvent(touchEnd), 50);
                
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        toast.style.transform = 'translateX(100%)';
                        toast.style.opacity = '0';
                        toast.style.transition = 'all 0.3s ease';
                        setTimeout(() => toast.remove(), 300);
                    }
                }, 300);
            } catch(e) {}
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
            const hideBtn = document.querySelector('.task-item--wrapper .btn--close');
            if (hideBtn) { hideBtn.click(); return true; }
            return false;
        }
        
        async function waitForHideFlag(timeout = SETTINGS.hideFlagTimeout) {
            const start = Date.now();
            console.log('⏳ Ожидание флага скрытия...');
            
            while (Date.now() - start < timeout) {
                const flag = GM_getValue('hide_current_task', null);
                if (flag === 'true') {
                    console.log('✅ Флаг скрытия получен');
                    GM_deleteValue('hide_current_task');
                    GM_deleteValue('hide_task_reason');
                    return true;
                }
                await new Promise(r => setTimeout(r, 200));
            }
            
            console.log('⏰ Таймаут ожидания флага');
            return false;
        }
        
        function waitForToast(timeout = 15000) {
            return new Promise((resolve) => {
                const checkToasts = () => {
                    const toasts = document.querySelectorAll('.toast');
                    for (const toast of toasts) {
                        const text = toast.innerText;
                        if (text.includes('успешно') || text.includes('зачислено')) {
                            setTimeout(() => dismissToast(toast), 500);
                            return { success: true, text };
                        }
                        if (text.includes('Упс') || text.includes('не выполнили')) {
                            setTimeout(() => dismissToast(toast), 500);
                            return { success: false, error: true, text };
                        }
                    }
                    return null;
                };
                
                const existing = checkToasts();
                if (existing) { resolve(existing); return; }
                
                let observer = new MutationObserver(() => {
                    const result = checkToasts();
                    if (result) { observer.disconnect(); resolve(result); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                setTimeout(() => { observer.disconnect(); resolve({ success: false, error: false, text: null }); }, timeout);
            });
        }
        
        async function clickCheck(task, isRetry = false) {
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;
            checkBtn.click();
            
            const result = await waitForToast(15000);
            
            if (result.success) {
                console.log(`✅ ВЫПОЛНЕНО! +${task.reward} монет`);
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();
                
                GM_notification({ title: '✅ Выполнено!', text: `+${task.reward} монет. Всего: ${stats.completed}`, timeout: 3000 });
                
                const hideData = new FormData();
                hideData.append('UserPerformTask[id]', task.id);
                hideData.append('UserPerformTask[task_execution_id]', task.execId);
                hideData.append('UserPerformTask[nonce]', task.nonce);
                hideData.append('UserPerformTask[submit]', 'hide');
                fetch('/lightning-action.php?action=tiktokfree_user_perform_task', { method: 'POST', body: hideData, credentials: 'same-origin' });
                task.wrapper?.remove();
                retryCount = 0;
                return true;
            }
            
            if (result.error) {
                if (isRetry) {
                    hideCurrentTask();
                    retryCount = 0;
                    return false;
                } else {
                    retryCount++;
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheck(task, true);
                }
            }
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
                        
                        waitForHideFlag(SETTINGS.hideFlagTimeout).then((needHide) => {
                            if (needHide) {
                                console.log('✅ Флаг найден! Скрываю задание без проверки');
                                hideCurrentTask();
                                resolve(false);
                                return;
                            }
                            
                            setTimeout(async () => {
                                const success = await clickCheck(task, false);
                                resolve(success);
                            }, SETTINGS.checkDelayAfterReturn);
                        });
                    }
                }, 500);
                
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(interval);
                        console.log('⏰ Таймаут ожидания возврата');
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
            const task = getTask();
            if (!task || !task.taskType) return false;
            console.log(`\n🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            return await waitForReturn(task);
        }
        
        // UI панель
        const panel = document.createElement('div');
        panel.style.cssText = `position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: linear-gradient(135deg, #667eea, #764ba2); padding: 12px; border-radius: 12px; color: white; font-family: monospace; font-size: 12px; min-width: 220px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);`;
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <b>🤖 TikTokFree Bot v8.0</b>
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
            console.log('\n🚀 БОТ ЗАПУЩЕН v8.0');
            console.log('📡 Селектор лайка: [data-e2e="play-side-like"] a\n');
            
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                if (!document.querySelector('.task-item--wrapper')) {
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
        
        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        window.botStats = () => console.log(`✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        
        updateUI();
        autoStartTimer = setTimeout(() => { if (!running) startBot(); }, SETTINGS.autoStartDelay);
        console.log('✅ Бот готов! botStats() - статистика');
    }
})();
