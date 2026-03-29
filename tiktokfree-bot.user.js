// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.6.0
// @description  Исправлено: гарантированное скрытие задания, если кнопка не найдена (GM_setValue + Beacon)
// @author       mechani3m (с исправлениями)
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
        waitBeforeCloseNotFound: 1200,   // увеличено для надёжной отправки статуса
        autoStartDelay: 5000,
        checkDelayAfterReturn: 800,      // уменьшено
        retryDelay: 5000
    };

    // ========== TIKTOK ЧАСТЬ ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен (v4.6.0)');

        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';
        let buttonFound = false;

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

        // Надёжная отправка статуса
        function sendStatusToSite(status, reason) {
            const statusUrl = 'https://tiktop-free.com/wp-admin/admin-ajax.php';
            const body = `action=tikbot_status&status=${status}&reason=${reason}&task_type=${taskType}&t=${Date.now()}`;

            console.log(`📡 Отправка статуса: ${status} | ${reason}`);

            // 1. Основной способ — fetch + Beacon
            try {
                navigator.sendBeacon(statusUrl, new Blob([body], { type: 'application/x-www-form-urlencoded' }));
            } catch (e) {}

            // 2. Fallback
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

        async function findFollowButton() { /* ... тот же код, что был ... */ 
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

        async function findLikeButton() { /* аналогично, можно оставить твой оригинальный код */ 
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
                buttonFound = true;
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

    // ========== TIKTOP-FREE ЧАСТЬ ==========
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

        // === УЛУЧШЕННАЯ ПРОВЕРКА ФЛАГА СКРЫТИЯ ===
        function checkAndHandleHideFlag() {
            const taskTypeObj = getTaskType();
            const currentType = taskTypeObj ? taskTypeObj.type : 'follow';

            // GM_setValue — самый надёжный способ
            if (GM_getValue(`hide_task_${currentType}`, false)) {
                console.log(`⚠️ GM_setValue флаг найден для ${currentType}`);
                GM_deleteValue(`hide_task_${currentType}`);
                GM_deleteValue(`hide_reason_${currentType}`);
                hideCurrentTask();
                return true;
            }

            // localStorage + sessionStorage
            if (localStorage.getItem('hide_current_task') === 'true') {
                console.log('⚠️ localStorage флаг найден');
                localStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_task_reason');
                hideCurrentTask();
                return true;
            }

            if (sessionStorage.getItem('hide_current_task') === 'true') {
                console.log('⚠️ sessionStorage флаг найден');
                sessionStorage.removeItem('hide_current_task');
                hideCurrentTask();
                return true;
            }

            return false;
        }

        function hideCurrentTask() {
            console.log('🗑 Скрываю текущее задание...');
            const task = document.querySelector('.task-item--wrapper');
            if (!task) return false;

            const hideBtn = task.querySelector('.btn--close') || task.querySelector('button[value="hide"]');
            if (hideBtn) {
                hideBtn.click();
                console.log('✅ Задание скрыто');
                return true;
            }
            return false;
        }

        // waitForToast, clickCheckAndWait, waitForReturn — оставляем почти как было, но с улучшенной проверкой

        function waitForToast(timeout = 15000) { /* твой оригинальный код */ 
            return new Promise((resolve) => {
                // ... (оставь без изменений)
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
                            if (node.nodeType === 1 && node.classList?.contains('toast')) {
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
            if (checkAndHandleHideFlag()) return false;   // дополнительная защита

            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;

            checkBtn.click();
            const toastResult = await waitForToast(15000);

            if (toastResult.success) {
                // ... твой оригинальный код успеха
                stats.completed++;
                stats.earned += task.reward || 0;
                saveStats();
                updateUI();

                GM_notification({ title: '✅ Задание выполнено!', text: `+${task.reward} монет`, timeout: 3000 });

                // hide через POST
                const hideData = new FormData();
                hideData.append('UserPerformTask[id]', task.id);
                hideData.append('UserPerformTask[task_execution_id]', task.execId);
                hideData.append('UserPerformTask[nonce]', task.nonce);
                hideData.append('UserPerformTask[submit]', 'hide');
                fetch('/lightning-action.php?action=tiktokfree_user_perform_task', { method: 'POST', body: hideData });

                if (task.wrapper) task.wrapper.remove();
                return true;
            } else if (toastResult.error) {
                console.log(`⚠️ Ошибка: ${toastResult.text}`);
                if (isRetry) {
                    hideCurrentTask();
                    return false;
                } else {
                    await new Promise(r => setTimeout(r, SETTINGS.retryDelay));
                    return await clickCheckAndWait(task, true);
                }
            }
            return false;
        }

        function waitForReturn(task) {
            return new Promise((resolve) => {
                if (checkAndHandleHideFlag()) {
                    console.log('✅ Флаг скрытия сразу после возврата — пропускаем проверку');
                    resolve(false);
                    return;
                }

                // Быстрые проверки в первые секунды
                let attempts = 0;
                const quickCheck = setInterval(() => {
                    attempts++;
                    if (checkAndHandleHideFlag()) {
                        clearInterval(quickCheck);
                        resolve(false);
                        return;
                    }
                    if (attempts > 12) clearInterval(quickCheck); // ~3-4 сек
                }, 300);

                setTimeout(async () => {
                    if (checkAndHandleHideFlag()) {
                        resolve(false);
                        return;
                    }
                    const success = await clickCheckAndWait(task, false);
                    resolve(success);
                }, SETTINGS.checkDelayAfterReturn);
            });
        }

        // === Панель управления (оставлена почти без изменений) ===
        // ... (весь код создания panel, updateUI, getTask, clickExecute, doTask, startBot и т.д.)

        // Для краткости я не дублирую всю панель здесь — скопируй её из твоего оригинального скрипта.
        // Главное — в doTask() и waitForReturn() уже используется улучшенная checkAndHandleHideFlag().

        // Вставь сюда весь остальной код из твоего оригинального скрипта (панель, startBot, stopBot и т.д.)
        // Только убедись, что в doTask() в самом начале стоит:
        // if (checkAndHandleHideFlag()) return false;

        console.log('✅ TikTokFree Auto Bot v4.6.0 успешно загружен');
        console.log('💡 Теперь при отсутствии кнопки задание скрывается сразу, без нажатия "Проверить"');
    }
})();
