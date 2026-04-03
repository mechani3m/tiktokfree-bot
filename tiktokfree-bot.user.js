// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      8.14.1
// @description  Вертикальная панель, кнопка Автостарт (без галочки)
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
        toastTimeout: 20000,
        resetAccountWait: 60000
    };
    
    const CONFIG = {
        autoStart: GM_getValue('autoStart', false)
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot v8.14 запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || GM_getValue('current_task_type', 'follow');
        let buttonClicked = false;
        
        function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
        
        function createPanels() {
            const topPanel = document.createElement('div');
            topPanel.id = 'tikbot-top-panel';
            topPanel.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                backdrop-filter: blur(5px);
                pointer-events: none;
            `;
            topPanel.innerHTML = `🤖 TikTok Bot Active`;
            document.body.appendChild(topPanel);
            
            const statusPanel = document.createElement('div');
            statusPanel.id = 'tikbot-status-panel';
            statusPanel.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 99999;
                background: rgba(0,0,0,0.85);
                color: #fff;
                padding: 10px 16px;
                border-radius: 12px;
                font-family: monospace;
                font-size: 12px;
                backdrop-filter: blur(8px);
                border-left: 3px solid #ffaa00;
                pointer-events: none;
                min-width: 200px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            statusPanel.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>📡</span>
                    <span>Статус: поиск кнопки...</span>
                </div>
                <div style="font-size: 10px; color: #aaa; margin-top: 4px;" id="webhook-status"></div>
            `;
            document.body.appendChild(statusPanel);
        }
        
        function updateStatus(text, isError = false, webhookText = null) {
            const panel = document.getElementById('tikbot-status-panel');
            if (panel) {
                const mainSpan = panel.querySelector('span:last-child');
                if (mainSpan) mainSpan.innerHTML = text;
                panel.style.borderLeftColor = isError ? '#f44336' : '#4caf50';
                const webhookDiv = document.getElementById('webhook-status');
                if (webhookDiv && webhookText) webhookDiv.innerHTML = webhookText;
            }
        }
        
        function updateWebhookStatus(action, status) {
            const webhookDiv = document.getElementById('webhook-status');
            if (webhookDiv) {
                const time = new Date().toLocaleTimeString();
                const statusIcon = status === 'ok' ? '✓' : (status === 'sending' ? '⏳' : '❌');
                const statusColor = status === 'ok' ? '#4caf50' : (status === 'sending' ? '#ffaa00' : '#f44336');
                webhookDiv.innerHTML = `<span style="color: ${statusColor}">[${time}] ${action}: ${statusIcon} ${status}</span><br>` + webhookDiv.innerHTML;
                const lines = webhookDiv.innerHTML.split('<br>');
                if (lines.length > 5) webhookDiv.innerHTML = lines.slice(0,5).join('<br>');
            }
        }
        
        function sendWebhook(action, payload = {}, attempt = 1) {
            const url = SETTINGS.webhookUrl + action;
            const data = { timestamp: Date.now(), url: location.href, taskType, ...payload };
            updateWebhookStatus(action, 'sending');
            GM_xmlhttpRequest({
                method: 'POST', url, timeout: SETTINGS.webhookTimeout,
                headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(data),
                onload: function(res) {
                    if (res.status >= 200 && res.status < 300) {
                        console.log(`✅ ${action}`);
                        updateWebhookStatus(action, 'ok');
                    } else { updateWebhookStatus(action, `error ${res.status}`); retry(); }
                },
                onerror: () => { updateWebhookStatus(action, 'network error'); retry(); },
                ontimeout: () => { updateWebhookStatus(action, 'timeout'); retry(); }
            });
            function retry() {
                if (attempt < SETTINGS.webhookMaxRetries) {
                    updateWebhookStatus(action, `retry ${attempt+1}/${SETTINGS.webhookMaxRetries}`);
                    setTimeout(() => sendWebhook(action, payload, attempt + 1), 2000 * attempt);
                } else updateWebhookStatus(action, 'failed');
            }
        }
        
        function addCompletionButton() {
            const oldBtn = document.getElementById('tikbot-complete-btn');
            if (oldBtn) oldBtn.remove();
            const btn = document.createElement('div');
            btn.id = 'tikbot-complete-btn';
            btn.innerHTML = `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff;padding:20px 40px;border-radius:60px;font-size:24px;font-weight:bold;cursor:pointer;animation:pulse 1s infinite;border:3px solid #fff">✅ ГОТОВО! Я ВЫПОЛНИЛ</div><style>@keyframes pulse{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.05)}100%{transform:translate(-50%,-50%) scale(1)}}</style>`;
            btn.onclick = () => {
                if (buttonClicked) return;
                buttonClicked = true;
                btn.remove();
                updateStatus('✅ Завершено!', false);
                localStorage.setItem('tikbot_action_completed', 'true');
                sendWebhook('/action_completed', { action: 'completed' });
                setTimeout(() => window.close(), 500);
            };
            document.body.appendChild(btn);
            updateStatus('✅ Кнопка найдена! Жду нажатия ГОТОВО', false);
            setTimeout(() => {
                if (!buttonClicked) {
                    const btnElement = document.getElementById('tikbot-complete-btn');
                    if (btnElement) { btnElement.remove(); updateStatus('⏰ Таймаут, закрываю', true); window.close(); }
                }
            }, 55000);
        }
        
        async function findFollowButton() {
            const selectors = ['[data-e2e="follow-button"]', 'button[aria-label*="Подписаться"]', 'button[aria-label*="Follow"]', 'button[class*="follow"]'];
            for (let a = 0; a < SETTINGS.searchAttempts; a++) {
                for (const s of selectors) {
                    const btn = document.querySelector(s);
                    if (btn && btn.offsetParent !== null) return btn;
                }
                const btns = document.querySelectorAll('button');
                for (const btn of btns) {
                    const text = btn.innerText?.toLowerCase() || '';
                    if (text.includes('подписаться') || text.includes('follow')) return btn;
                }
                if (a < SETTINGS.searchAttempts-1) await delay(SETTINGS.searchInterval);
            }
            return null;
        }
        
        async function findLikeButton() {
            const selector = '[data-e2e="play-side-like"] a';
            for (let a = 0; a < SETTINGS.searchAttempts; a++) {
                const el = document.querySelector(selector);
                if (el && el.offsetParent !== null) return el;
                if (a < SETTINGS.searchAttempts-1) await delay(SETTINGS.searchInterval);
            }
            return null;
        }
        
        async function run() {
            createPanels();
            await delay(1500);
            let button = null;
            if (taskType === 'follow') button = await findFollowButton();
            else button = await findLikeButton();
            
            if (button) {
                console.log(`✅ ${taskType} кнопка найдена`);
                updateStatus('🔍 Кнопка найдена, отправляю вебхук...', false);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                addCompletionButton();
            } else {
                console.log(`❌ ${taskType} кнопка НЕ найдена`);
                updateStatus('❌ Кнопка НЕ найдена!', true);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                GM_setValue('hide_current_task', 'true');
                setTimeout(() => window.close(), SETTINGS.waitAfterNotFound);
            }
        }
        run();
        return;
    }
    
    // ========== TIKTOPFREE ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot v8.14 запущен');
        
        let running = false;
        let autoStartTimer = null;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;
        
        const savedStats = GM_getValue('botStats', null);
        if (savedStats) stats = savedStats;
        
        function saveStats() { GM_setValue('botStats', stats); }
        
        function dismissToast(toast) {
            if (!toast) return;
            const closeBtn = toast.querySelector('.toast-close, .close, button');
            if (closeBtn) { closeBtn.click(); return; }
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
        
        function getAccountLogin() {
            let el = document.querySelector('.executor--username.text-overflow-ellipsis.text-gray');
            if (el) return el.innerText.trim();
            el = document.querySelector('.executor--username');
            if (el) return el.innerText.trim();
            el = document.querySelector('.executor--username a');
            if (el) return el.innerText.trim();
            return null;
        }
        
        function updateAccountLogin() {
            const login = getAccountLogin();
            const loginPlace = document.getElementById('account-login-place');
            if (loginPlace) loginPlace.innerHTML = login ? `🎭 ${login}` : '🎭 ---';
        }
        
        function checkAndHandleResetAccount() {
            const resetBtn = document.querySelector('.btn-reset_account.btn--yellow');
            if (resetBtn && resetBtn.offsetParent !== null) {
                console.log('⚠️ Смена аккаунта, пауза 60 сек');
                const panel = document.querySelector('.tikbot-panel');
                if (panel) {
                    let statusLine = panel.querySelector('.tikbot-reset-status');
                    if (!statusLine) {
                        statusLine = document.createElement('div');
                        statusLine.className = 'tikbot-reset-status';
                        statusLine.style.cssText = 'margin-top: 6px; font-size: 10px; color: #ffaa00;';
                        panel.appendChild(statusLine);
                    }
                    let secondsLeft = 60;
                    statusLine.innerHTML = `⏳ Ожидание выбора аккаунта... ${secondsLeft} сек`;
                    const countdown = setInterval(() => {
                        secondsLeft--;
                        if (secondsLeft > 0) statusLine.innerHTML = `⏳ Ожидание выбора аккаунта... ${secondsLeft} сек`;
                        else { clearInterval(countdown); statusLine.innerHTML = `✅ Пауза завершена`; setTimeout(() => statusLine.remove(), 3000); }
                    }, 1000);
                }
                return true;
            }
            return false;
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
            if (hideBtn) { hideBtn.click(); console.log('🗑 задание скрыто'); return true; }
            return false;
        }
        
        async function waitForHideFlag(timeout = SETTINGS.hideFlagTimeout) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const flag = GM_getValue('hide_current_task', null);
                if (flag === 'true') { GM_deleteValue('hide_current_task'); console.log('🚩 флаг скрытия получен'); return true; }
                await new Promise(r => setTimeout(r, 200));
            }
            return false;
        }
        
        function waitForToast(timeout = SETTINGS.toastTimeout) {
            return new Promise((resolve) => {
                const check = () => {
                    const toasts = document.querySelectorAll('.toast');
                    for (const t of toasts) {
                        const text = t.innerText;
                        if (text.includes('успешно') || text.includes('зачислено')) {
                            setTimeout(() => dismissToast(t), 500);
                            return { success: true };
                        }
                        if (text.includes('Упс') || text.includes('не выполнили') || text.includes('Не удалось проверить')) {
                            setTimeout(() => dismissToast(t), 500);
                            return { success: false, error: true };
                        }
                    }
                    return null;
                };
                const existing = check();
                if (existing) { resolve(existing); return; }
                const observer = new MutationObserver(() => { const r = check(); if (r) { observer.disconnect(); resolve(r); } });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve({ success: false }); }, timeout);
            });
        }
        
        async function clickCheck(task, attempt = 1) {
            console.log(`🔍 проверка ${attempt}/${SETTINGS.maxRetries}`);
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
                fetch('/lightning-action.php?action=tiktokfree_user_perform_task', { method: 'POST', body: hideData });
                task.wrapper?.remove();
                return true;
            }
            if (result.error && attempt < SETTINGS.maxRetries) {
                await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                return await clickCheck(task, attempt + 1);
            }
            if (attempt >= SETTINGS.maxRetries) hideCurrentTask();
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
                        updateAccountLogin();
                        waitForHideFlag(SETTINGS.hideFlagTimeout).then(needHide => {
                            if (needHide) { hideCurrentTask(); resolve(false); return; }
                            setTimeout(async () => resolve(await clickCheck(task)), SETTINGS.checkDelayAfterReturn);
                        });
                    }
                }, 500);
                setTimeout(() => { if (!resolved) resolve(false); }, 60000);
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
            if (checkAndHandleResetAccount()) {
                await new Promise(r => setTimeout(r, SETTINGS.resetAccountWait));
                location.reload();
                return false;
            }
            const task = getTask();
            if (!task || !task.taskType) return false;
            console.log(`\n🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            return await waitForReturn(task);
        }
        
        // ========== НОВАЯ ПАНЕЛЬ (ВЕРТИКАЛЬНАЯ, КНОПКИ) ==========
        function createUIPanel() {
    const panel = document.createElement('div');
    panel.className = 'tikbot-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 0;
        margin-right: 12px;
        z-index: 9999;
        background: #1e1e2e;
        border-radius: 20px;
        padding: 14px 16px;
        width: 200px;
        text-align: left;
        font-family: monospace;
        font-size: 13px;
        color: #cdd6f4;
        border: 1px solid #313244;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 14px;">🤖 TikTokFree Bot v8.14</span>
            <span id="bot-status" style="background: #f38ba8; padding: 2px 8px; border-radius: 12px; font-size: 11px;">СТОП</span>
        </div>
        <div>💰 <span id="balance">0</span></div>
        <div>✅ <span id="completed">0</span></div>
        <div>💎 <span id="earned">0.00</span></div>
        <div id="account-login-place" style="color: #89b4fa;">🎭 ---</div>
        <div style="display: flex; gap: 8px; flex-direction: column;">
            <button id="start-btn" style="width:100%; background:#a6e3a1; border:none; border-radius:8px; padding:8px; cursor:pointer; font-weight:bold; color:#111; font-size:13px;">▶ СТАРТ</button>
            <button id="stop-btn" style="width:100%; background:#f38ba8; border:none; border-radius:8px; padding:8px; cursor:pointer; font-weight:bold; color:#111; font-size:13px;">⏹ СТОП</button>
            <button id="reset-stats" style="width:100%; background:#313244; border:none; border-radius:8px; padding:8px; cursor:pointer; font-weight:bold; color:#cdd6f4; font-size:13px;">🔄 Сброс</button>
            <button id="auto-start-btn" style="width:100%; background:#313244; border:none; border-radius:8px; padding:8px; cursor:pointer; font-weight:bold; color:#cdd6f4; font-size:13px;">⚙ Автостарт</button>
        </div>
    `;
    document.body.appendChild(panel);
    
    function updateAutoStartButton() {
        const btn = document.getElementById('auto-start-btn');
        if (btn) {
            if (CONFIG.autoStart) {
                btn.style.background = '#89b4fa';
                btn.style.color = '#1e1e2e';
                btn.innerHTML = '✅ Автостарт';
            } else {
                btn.style.background = '#313244';
                btn.style.color = '#cdd6f4';
                btn.innerHTML = '⚙ Автостарт';
            }
        }
    }
    
    document.getElementById('start-btn').onclick = () => startBot();
    document.getElementById('stop-btn').onclick = () => stopBot();
    document.getElementById('reset-stats').onclick = () => { stats = { completed: 0, earned: 0 }; saveStats(); updateUI(); };
    document.getElementById('auto-start-btn').onclick = () => {
        CONFIG.autoStart = !CONFIG.autoStart;
        GM_setValue('autoStart', CONFIG.autoStart);
        updateAutoStartButton();
        console.log(`⚙️ автостарт: ${CONFIG.autoStart ? 'ВКЛ' : 'ВЫКЛ'}`);
    };
    
    updateAutoStartButton();
    updateAccountLogin();
    setTimeout(updateAccountLogin, 2000);
}
        
        function updateUI() {
            const balance = document.querySelector('.user-balance')?.innerText || '0';
            document.getElementById('balance').innerText = balance;
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
            const statusEl = document.getElementById('bot-status');
            statusEl.innerText = running ? 'РАБ' : 'СТОП';
            statusEl.style.background = running ? '#a6e3a1' : '#f38ba8';
            statusEl.style.color = '#111';
            updateAccountLogin();
        }
        
        async function startBot() {
            if (running) return;
            running = true;
            updateUI();
            console.log('\n🚀 БОТ ЗАПУЩЕН v8.14');
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                if (!document.querySelector('.task-item--wrapper')) location.reload();
            }
            running = false;
            updateUI();
            console.log(`\n🏁 ОСТАНОВЛЕН | ✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        }
        
        function stopBot() { running = false; updateUI(); }
        
        createUIPanel();
        updateUI();
        if (CONFIG.autoStart) {
            console.log(`⏳ автостарт через ${SETTINGS.autoStartDelay/1000}с`);
            autoStartTimer = setTimeout(() => { if (!running) startBot(); }, SETTINGS.autoStartDelay);
        }
        window.botStats = () => console.log(`✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        console.log('✅ бот готов | botStats()');
        if (!CONFIG.autoStart) console.log('💡 нажми СТАРТ');
    }
})();
