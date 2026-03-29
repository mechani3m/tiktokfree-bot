// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.7.0
// @description  Гарантированное скрытие задания если кнопка не найдена (GM_setValue + Beacon)
// @author       mechani3m (исправленная версия)
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
// @connect      tiktop-free.com
// @downloadURL  https://raw.githubusercontent.com/mechani3m/tiktokfree-bot/main/tiktokfree-bot.user.js
// @updateURL    https://raw.githubusercontent.com/mechani3m/tiktokfree-bot/main/tiktokfree-bot.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const isTikTok = location.hostname.includes('tiktok.com');
    const isTikTopFree = location.hostname.includes('tiktop-free.com');

    // ========== НАСТРОЙКИ ==========
    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        waitBeforeCloseFound: 15000,
        waitBeforeCloseNotFound: 1200,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 800,
        retryDelay: 5000
    };

    // ========== TIKTOK ЧАСТЬ ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен (v4.6.0)');

        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';

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

        function sendStatusToSite(status, reason) {
            const statusUrl = 'https://tiktop-free.com/wp-admin/admin-ajax.php';
            const body = `action=tikbot_status&status=${status}&reason=${reason}&task_type=${taskType}&t=${Date.now()}`;

            console.log(`📡 Отправка статуса: ${status} | причина: ${reason}`);

            // Самый надёжный способ
            try {
                navigator.sendBeacon(statusUrl, new Blob([body], { type: 'application/x-www-form-urlencoded' }));
            } catch (e) {}

            // Fallback
            fetch(statusUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body,
                keepalive: true
            }).catch(() => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: statusUrl,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: body
                });
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

            for (let attempt = 0; attempt < 8; attempt++) {
                for (const selector of selectors) {
                    const btn = document.querySelector(selector);
                    if (btn && btn.offsetParent !== null) return btn;
                }

                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = (btn.innerText || '').toLowerCase();
                    if (text.includes('подписаться') || text.includes('follow')) return btn;
                }

                if (attempt < 7) await delay(400);
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

            for (let attempt = 0; attempt < 8; attempt++) {
                for (const selector of selectors) {
                    const btn = document.querySelector(selector);
                    if (btn && btn.offsetParent !== null) return btn;
                }

                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = (btn.innerText || '').toLowerCase();
                    if (text.includes('нравится') || text.includes('like')) return btn;
                }

                if (attempt < 7) await delay(400);
            }
            return null;
        }

        async function run() {
            console.log('🔍 Поиск кнопки...');

            let button = null;
            if (taskType === 'follow') {
                button = await findFollowButton();
            } else {
                button = await findLikeButton();
            }

            if (button) {
                console.log(`✅ Кнопка ${taskType} найдена!`);
                sendWebhook(`/${taskType}`, { buttonFound: true });
                sendStatusToSite('found', '');

                const indicator = document.createElement('div');
                indicator.style.cssText = `position:fixed;bottom:10px;left:10px;z-index:9999;background:#0a0;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;`;
                indicator.textContent = `✅ ${taskType.toUpperCase()} найдена!`;
                document.body.appendChild(indicator);

                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseFound);
            } else {
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА!`);

                // === ГЛАВНОЕ ИСПРАВЛЕНИЕ ===
                GM_setValue(`hide_task_${taskType}`, true);
                GM_setValue(`hide_reason_${taskType}`, `button_${taskType}_not_found`);

                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                sendStatusToSite('not_found', `button_${taskType}_not_found`);

                localStorage.setItem('hide_current_task', 'true');
                sessionStorage.setItem('hide_current_task', 'true');

                const indicator = document.createElement('div');
                indicator.style.cssText = `position:fixed;bottom:10px;left:10px;z-index:9999;background:#a00;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;`;
                indicator.textContent = `❌ ${taskType.toUpperCase()} НЕ найдена!`;
                document.body.appendChild(indicator);

                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseNotFound);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }

        return;
    }

    // ========== TIKTOPFREE ЧАСТЬ ==========
    if (isTikTopFree) {
        console.log('🤖 TikTopFree Bot запущен (v4.6.0)');

        let running = false;
        let autoStartTimer = null;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;

        const savedStats = GM_getValue('botStats', null);
        if (savedStats) stats = savedStats;

        function saveStats() {
            GM_setValue('botStats', stats);
        }

        function getTaskType() {
            const titleEl = document.querySelector('.list-item--title.task-item--title');
            if (!titleEl) return null;
            const text = titleEl.innerText || titleEl.textContent || '';
            if (text.includes('Подписаться')) return { type: 'follow', name: 'Подписка' };
            if (text.includes('лайк') || text.includes('Like')) return { type: 'like', name: 'Лайк' };
            return null;
        }

        function hideCurrentTask() {
            console.log('🗑 Скрываю текущее задание...');
            const task = document.querySelector('.task-item--wrapper');
            if (!task) return false;

            const hideBtn = task.querySelector('.btn--close') || task.querySelector('button[value="hide"]');
            if (hideBtn) {
                hideBtn.click();
                console.log('✅ Задание скрыто через кнопку');
                return true;
            }
            console.log('❌ Не удалось найти кнопку скрытия');
            return false;
        }

        function checkAndHandleHideFlag() {
            const taskTypeObj = getTaskType();
            const currentType = taskTypeObj ? taskTypeObj.type : 'follow';

            // Самый надёжный способ — GM_setValue
            if (GM_getValue(`hide_task_${currentType}`, false)) {
                console.log(`⚠️ Найден GM_setValue флаг для ${currentType}`);
                GM_deleteValue(`hide_task_${currentType}`);
                GM_deleteValue(`hide_reason_${currentType}`);
                hideCurrentTask();
                return true;
            }

            // Дополнительно проверяем localStorage и sessionStorage
            if (localStorage.getItem('hide_current_task') === 'true') {
                console.log('⚠️ Найден флаг в localStorage');
                localStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_task_reason');
                hideCurrentTask();
                return true;
            }

            if (sessionStorage.getItem('hide_current_task') === 'true') {
                console.log('⚠️ Найден флаг в sessionStorage');
                sessionStorage.removeItem('hide_current_task');
                hideCurrentTask();
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
                        resolve({ success: true, error: false, text });
                        return;
                    }
                    if (text.includes('Упс') || text.includes('не выполнили')) {
                        resolve({ success: false, error: true, text });
                        return;
                    }
                }

                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && node.classList && node.classList.contains('toast')) {
                                const text = node.innerText || node.textContent;
                                if (text.includes('успешно') || text.includes('зачислено')) {
                                    observer.disconnect();
                                    resolve({ success: true, error: false, text });
                                    return;
                                }
                                if (text.includes('Упс') || text.includes('не выполнили')) {
                                    observer.disconnect();
                                    resolve({ success: false, error: true, text });
                                    return;
                                }
                            }
                        }
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                setTimeout(() => {
                    observer.disconnect();
                    resolve({ success: false, error: false, text: null });
                }, timeout);
            });
        }

        async function clickCheckAndWait(task, isRetry = false) {
            if (checkAndHandleHideFlag()) {
                console.log('⚠️ Флаг скрытия обнаружен перед проверкой — пропускаем');
                return false;
            }

            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) {
                console.log('❌ Кнопка "Проверить" не найдена');
                return false;
            }

            checkBtn.click();
            console.log('🔘 Кнопка "Проверить" нажата');

            const toastResult = await waitForToast(15000);

            if (toastResult.success) {
                console.log(`✅ Задание выполнено! +${task.reward} монет`);
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();

                try {
                    new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3').play().catch(() => {});
                } catch (e) {}

                GM_notification({
                    title: '✅ Задание выполнено!',
                    text: `+${task.reward} монет`,
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

            } else if (toastResult.error) {
                console.log(`⚠️ Ошибка: ${toastResult.text}`);
                if (isRetry) {
                    console.log('❌ Повторная ошибка — скрываю задание');
                    hideCurrentTask();
                    return false;
                } else {
                    console.log(`🔄 Пауза ${SETTINGS.retryDelay/1000} сек перед повторной проверкой...`);
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheckAndWait(task, true);
                }
            } else {
                console.log('❌ Тост не появился');
                return false;
            }
        }

        function waitForReturn(task) {
            return new Promise((resolve) => {
                if (checkAndHandleHideFlag()) {
                    console.log('✅ Флаг скрытия сразу после возврата — проверка отменена');
                    resolve(false);
                    return;
                }

                // Быстрые проверки каждые 300мс
                let attempts = 0;
                const quickInterval = setInterval(() => {
                    attempts++;
                    if (checkAndHandleHideFlag()) {
                        clearInterval(quickInterval);
                        resolve(false);
                        return;
                    }
                    if (attempts >= 15) clearInterval(quickInterval);
                }, 300);

                setTimeout(async () => {
                    if (checkAndHandleHideFlag()) {
                        resolve(false);
                        return;
                    }

                    console.log(`⏳ Пауза ${SETTINGS.checkDelayAfterReturn/1000} сек перед проверкой...`);
                    const success = await clickCheckAndWait(task, false);
                    resolve(success);
                }, SETTINGS.checkDelayAfterReturn);
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
            localStorage.setItem('current_task_type', taskType?.type || 'follow');
            const separator = url.includes('?') ? '&' : '?';
            window.open(`${url}${separator}task_type=${taskType?.type || 'follow'}`, '_blank');
        }

        async function doTask() {
            if (checkAndHandleHideFlag()) {
                console.log('⚠️ Флаг скрытия обнаружен — пропускаем задание');
                return false;
            }

            const task = getTask();
            if (!task || !task.taskType) {
                console.log('❌ Задание или тип не определён');
                return false;
            }

            console.log(`🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);

            const success = await waitForReturn(task);
            return success;
        }

        async function startBot(showMessage = true) {
            if (running) return;
            running = true;
            updateUI();

            if (showMessage) {
                console.log('\n🚀 БОТ ЗАПУЩЕН (v4.6.0)');
                console.log('✅ Теперь при отсутствии кнопки задание скрывается сразу без проверки\n');
            }

            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));

                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания закончились, обновляю страницу...');
                    GM_setValue('botWasRunning', true);
                    setTimeout(() => location.reload(), 7000);
                    break;
                }
            }

            running = false;
            updateUI();
        }

        function stopBot() {
            running = false;
            if (checkInterval) clearInterval(checkInterval);
            if (autoStartTimer) clearTimeout(autoStartTimer);
            updateUI();
            console.log('🛑 Бот остановлен');
        }

        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
            console.log('📊 Статистика сброшена');
        }

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

        function scheduleAutoStart() {
            if (autoStartTimer) clearTimeout(autoStartTimer);
            let secondsLeft = SETTINGS.autoStartDelay / 1000;
            updateAutoStatus(`⏳ Автозапуск через ${secondsLeft} сек...`);

            autoStartTimer = setTimeout(() => {
                if (!running) startBot(true);
            }, SETTINGS.autoStartDelay);
        }

        // ========== СОЗДАНИЕ ПАНЕЛИ ==========
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 12px; border-radius: 12px; color: white;
            font-family: monospace; font-size: 12px; min-width: 240px;
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

        document.getElementById('start-btn').onclick = () => startBot(true);
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;

        updateUI();
        scheduleAutoStart();

        console.log('✅ TikTokFree Auto Bot v4.6.0 готов к работе!');
        console.log('💡 Теперь задания без кнопки скрываются сразу, без нажатия "Проверить"');
    }
})();
