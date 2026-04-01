// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      8.5.0
// @description  Минималистичная панель, подробные логи
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
        waitAfterFound: 60000,
        waitAfterNotFound: 3000,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 2000,
        retryDelay: 5000,
        maxRetries: 3,
        searchAttempts: 10,
        searchInterval: 500,
        webhookTimeout: 10000,
        webhookMaxRetries: 3,
        hideFlagTimeout: 5000,
        toastTimeout: 20000
    };
    
    const CONFIG = {
        autoStart: GM_getValue('autoStart', false)
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot v8.5');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || GM_getValue('current_task_type', 'follow');
        let buttonClicked = false;
        
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
            
            console.log(`📡 [${action}] отправка (${attempt}/${SETTINGS.webhookMaxRetries})`);
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                timeout: SETTINGS.webhookTimeout,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(data),
                onload: function(res) {
                    if (res.status >= 200 && res.status < 300) {
                        console.log(`✅ [${action}] отправлен (${res.status})`);
                    } else {
                        console.log(`⚠️ [${action}] ошибка ${res.status}`);
                        retry();
                    }
                },
                onerror: function(e) {
                    console.log(`❌ [${action}] сеть`);
                    retry();
                },
                ontimeout: function() {
                    console.log(`⏳ [${action}] таймаут`);
                    retry();
                }
            });
            
            function retry() {
                if (attempt < SETTINGS.webhookMaxRetries) {
                    const delayMs = 2000 * attempt;
                    console.log(`🔁 повтор через ${delayMs/1000}с`);
                    setTimeout(() => {
                        sendWebhook(action, payload, attempt + 1);
                    }, delayMs);
                } else {
                    console.log(`❌ [${action}] не отправлен`);
                }
            }
        }
        
        function addCompletionButton() {
            const oldBtn = document.getElementById('tikbot-complete-btn');
            if (oldBtn) oldBtn.remove();
            
            const btn = document.createElement('div');
            btn.id = 'tikbot-complete-btn';
            btn.innerHTML = `
                <div style="
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 99999;
                    background: #2e7d32;
                    color: white;
                    padding: 16px 32px;
                    border-radius: 48px;
                    font-size: 20px;
                    font-weight: bold;
                    font-family: monospace;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border: 2px solid white;
                ">
                    <span>✅</span>
                    <span>ГОТОВО</span>
                </div>
            `;
            
            btn.onclick = () => {
                if (buttonClicked) return;
                buttonClicked = true;
                console.log('🔘 ГОТОВО нажата');
                btn.remove();
                localStorage.setItem('tikbot_action_completed', 'true');
                sendWebhook('/action_completed', { action: 'completed' });
                setTimeout(() => window.close(), 500);
            };
            
            document.body.appendChild(btn);
            console.log('✅ кнопка ГОТОВО добавлена');
            
            setTimeout(() => {
                if (!buttonClicked) {
                    const btnElement = document.getElementById('tikbot-complete-btn');
                    if (btnElement) {
                        btnElement.remove();
                        console.log('⏰ таймаут, закрываю');
                        window.close();
                    }
                }
            }, 55000);
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
        
        async function findLikeButton() {
            const selector = '[data-e2e="play-side-like"] a';
            for (let attempt = 0; attempt < SETTINGS.searchAttempts; attempt++) {
                try {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) return element;
                } catch(e) {}
                if (attempt < SETTINGS.searchAttempts - 1) await delay(SETTINGS.searchInterval);
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
                console.log(`✅ ${taskType} кнопка найдена`);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                addCompletionButton();
            } else {
                console.log(`❌ ${taskType} кнопка НЕ найдена`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                GM_setValue('hide_current_task', 'true');
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
        console.log('🤖 TikTokFree Bot v8.5');
        
        let running = false;
        let autoStartTimer = null;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;
        
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) stats = savedStats;
        
        function saveStats() {
            GM_setValue('botStats', stats);
        }
        
        function dismissToast(toast) {
            if (!toast || !document.body.contains(toast)) return;
            const closeBtn = toast.querySelector('.toast-close, .close, [aria-label="Close"], button');
            if (closeBtn) { closeBtn.click(); return; }
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
            if (titleText.includes('Подписаться')) return { type: 'follow', name: '📌 Подписка' };
            if (titleText.includes('лайк') || titleText.includes('Like')) return { type: 'like', name: '❤️ Лайк' };
            return null;
        }
        
        function hideCurrentTask() {
            const hideBtn = document.querySelector('.task-item--wrapper .btn--close');
            if (hideBtn) { 
                hideBtn.click(); 
                console.log('🗑 задание скрыто');
                return true; 
            }
            return false;
        }
        
        async function waitForHideFlag(timeout = SETTINGS.hideFlagTimeout) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const flag = GM_getValue('hide_current_task', null);
                if (flag === 'true') {
                    GM_deleteValue('hide_current_task');
                    console.log('🚩 флаг скрытия получен');
                    return true;
                }
                await new Promise(r => setTimeout(r, 200));
            }
            return false;
        }
        
        function waitForToast(timeout = SETTINGS.toastTimeout) {
            return new Promise((resolve) => {
                const checkToasts = () => {
                    const toasts = document.querySelectorAll('.toast');
                    for (const toast of toasts) {
                        const text = toast.innerText;
                        if (text.includes('успешно') || text.includes('зачислено')) {
                            setTimeout(() => dismissToast(toast), 500);
                            return { success: true, error: false, text };
                        }
                        if (text.includes('Упс') || text.includes('не выполнили') || 
                            text.includes('Не удалось проверить') || text.includes('попробуйте еще раз')) {
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
        
        async function clickCheck(task, currentAttempt = 1) {
            console.log(`🔍 проверка ${currentAttempt}/${SETTINGS.maxRetries}`);
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;
            checkBtn.click();
            
            const result = await waitForToast(SETTINGS.toastTimeout);
            
            if (result.success) {
                console.log(`✅ ВЫПОЛНЕНО! +${task.reward} монет`);
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();
                GM_notification({ title: '✅ Выполнено!', text: `+${task.reward} монет`, timeout: 2000 });
                const hideData = new FormData();
                hideData.append('UserPerformTask[id]', task.id);
                hideData.append('UserPerformTask[task_execution_id]', task.execId);
                hideData.append('UserPerformTask[nonce]', task.nonce);
                hideData.append('UserPerformTask[submit]', 'hide');
                fetch('/lightning-action.php?action=tiktokfree_user_perform_task', { method: 'POST', body: hideData, credentials: 'same-origin' });
                task.wrapper?.remove();
                return true;
            }
            
            if (result.error) {
                console.log(`⚠️ ошибка: ${result.text}`);
                if (currentAttempt >= SETTINGS.maxRetries) {
                    console.log(`❌ после ${SETTINGS.maxRetries} попыток — скрываю`);
                    hideCurrentTask();
                    return false;
                } else {
                    console.log(`🔄 повтор через ${SETTINGS.retryDelay/1000}с`);
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheck(task, currentAttempt + 1);
                }
            }
            console.log(`❌ нет ответа`);
            return false;
        }
        
        function waitForReturn(task) {
            return new Promise((resolve) => {
                let resolved = false;
                const interval = setInterval(() => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(interval);
                        console.log('👀 возврат на сайт');
                        waitForHideFlag(SETTINGS.hideFlagTimeout).then((needHide) => {
                            if (needHide) {
                                hideCurrentTask();
                                resolve(false);
                                return;
                            }
                            setTimeout(async () => {
                                const success = await clickCheck(task, 1);
                                resolve(success);
                            }, SETTINGS.checkDelayAfterReturn);
                        });
                    }
                }, 500);
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(interval);
                        console.log('⏰ таймаут возврата');
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
            console.log(`🚀 открываю TikTok`);
            window.open(`${url}${separator}task_type=${taskType?.type || 'follow'}`, '_blank');
        }
        
        async function doTask() {
            const task = getTask();
            if (!task || !task.taskType) return false;
            console.log(`\n🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            return await waitForReturn(task);
        }
        
        // МИНИМАЛИСТИЧНАЯ ПАНЕЛЬ
        function createUIPanel() {
            const panel = document.createElement('div');
            panel.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 12px;
                z-index: 9999;
                background: #1e1e2e;
                padding: 10px 14px;
                border-radius: 8px;
                color: #cdd6f4;
                font-family: monospace;
                font-size: 11px;
                min-width: 180px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                border: 1px solid #313244;
            `;
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <b>🤖 TF Bot</b>
                    <span id="bot-status" style="background: #f38ba8; padding: 2px 8px; border-radius: 12px;">СТОП</span>
                </div>
                <div>💰 <span id="balance">0</span> | ✅ <span id="completed">0</span> | 💎 <span id="earned">0</span></div>
                <div style="margin: 6px 0; display: flex; gap: 6px;">
                    <button id="start-btn" style="flex:1; background:#a6e3a1; border:none; border-radius:4px; padding:4px; cursor:pointer; color:#111;">▶</button>
                    <button id="stop-btn" style="flex:1; background:#f38ba8; border:none; border-radius:4px; padding:4px; cursor:pointer; color:#111;">⏹</button>
                    <button id="config-btn" style="background:#cba6f7; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">⚙</button>
                </div>
                <div id="settings-panel" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px solid #313244;">
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="checkbox" id="auto-start-checkbox" ${CONFIG.autoStart ? 'checked' : ''}>
                        <span>автостарт</span>
                    </label>
                </div>
                <button id="reset-stats" style="width:100%; background:#313244; border:none; border-radius:4px; padding:3px; margin-top:6px; cursor:pointer; color:#cdd6f4; font-size:10px;">сброс</button>
            `;
            document.body.appendChild(panel);
            
            document.getElementById('start-btn').onclick = () => startBot();
            document.getElementById('stop-btn').onclick = () => stopBot();
            document.getElementById('reset-stats').onclick = () => resetStats();
            document.getElementById('config-btn').onclick = () => {
                const settings = document.getElementById('settings-panel');
                settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
            };
            document.getElementById('auto-start-checkbox').onchange = (e) => {
                CONFIG.autoStart = e.target.checked;
                GM_setValue('autoStart', CONFIG.autoStart);
                console.log(`⚙️ автостарт: ${CONFIG.autoStart ? 'вкл' : 'выкл'}`);
            };
        }
        
        function updateUI() {
            const balance = document.querySelector('.user-balance')?.innerText || '0';
            document.getElementById('balance').innerText = balance;
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
            const statusEl = document.getElementById('bot-status');
            statusEl.innerText = running ? 'РАБ' : 'СТОП';
            statusEl.style.background = running ? '#a6e3a1' : '#f38ba8';
            statusEl.style.color = running ? '#111' : '#111';
        }
        
        async function startBot() {
            if (running) return;
            running = true;
            updateUI();
            console.log('\n🚀 СТАРТ');
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 задания кончились, обновляю');
                    setTimeout(() => location.reload(), 2000);
                    break;
                }
            }
            running = false;
            updateUI();
            console.log(`\n🏁 СТОП | ✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        }
        
        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            if (autoStartTimer) clearTimeout(autoStartTimer);
            console.log('🛑 стоп');
            updateUI();
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 статистика сброшена');
        }
        
        createUIPanel();
        updateUI();
        
        if (CONFIG.autoStart) {
            console.log(`⏳ автостарт через ${SETTINGS.autoStartDelay/1000}с`);
            autoStartTimer = setTimeout(() => {
                if (!running) startBot();
            }, SETTINGS.autoStartDelay);
        }
        
        window.botStats = () => console.log(`✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        console.log('✅ готов | botStats()');
        if (!CONFIG.autoStart) console.log('💡 нажми СТАРТ');
    }
})();
