// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.7.0
// @description  Исправлено: не нажимает "Проверить" пока TikTok не загрузится
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

    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        waitBeforeCloseFound: 15000,
        waitBeforeCloseNotFound: 1500,
        autoStartDelay: 5000,
        initialWaitAfterOpen: 4000,     // ← НОВАЯ ЗАДЕРЖКА (4 сек)
        checkDelayAfterReturn: 1000,
        retryDelay: 5000
    };

    // ==================== TIKTOK ЧАСТЬ ====================
    if (isTikTok) {
        console.log('🎯 TikTok Bot v4.7.0 запущен');

        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';

        function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

        function sendStatusToSite(status, reason) {
            const url = 'https://tiktop-free.com/wp-admin/admin-ajax.php';
            const body = `action=tikbot_status&status=${status}&reason=${reason}&task_type=${taskType}&t=${Date.now()}`;

            try { navigator.sendBeacon(url, new Blob([body], {type: 'application/x-www-form-urlencoded'})); } catch(e){}
            fetch(url, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body, keepalive:true})
                .catch(() => GM_xmlhttpRequest({method:'POST', url, headers:{'Content-Type':'application/x-www-form-urlencoded'}, data:body}));
        }

        async function findButton(isFollow) {
            const selectors = isFollow ? [
                '[data-e2e="follow-button"]', 'button[aria-label*="Подписаться"]', 'button[aria-label*="Follow"]'
            ] : [
                '[data-e2e="like-button"]', 'button[aria-label*="Нравится"]', 'button[aria-label*="Like"]', 'span[data-e2e="like-icon"]'
            ];

            for (let i = 0; i < 10; i++) {
                for (const sel of selectors) {
                    const btn = document.querySelector(sel);
                    if (btn && btn.offsetParent !== null) return btn;
                }
                await delay(400);
            }
            return null;
        }

        async function run() {
            const isFollow = taskType === 'follow';
            console.log(`🔍 Ищем кнопку: ${isFollow ? 'Подписка' : 'Лайк'}`);

            const button = await findButton(isFollow);

            if (button) {
                console.log(`✅ Кнопка найдена!`);
                sendStatusToSite('found', '');
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseFound);
            } else {
                console.log(`❌ Кнопка НЕ найдена!`);
                GM_setValue(`hide_task_${taskType}`, true);
                sendStatusToSite('not_found', `button_${taskType}_not_found`);
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseNotFound);
            }
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
        else run();

        return;
    }

    // ==================== TIKTOP-FREE ЧАСТЬ ====================
    if (isTikTopFree) {
        console.log('🤖 TikTopFree Bot v4.7.0 запущен');

        let running = false;
        let autoStartTimer = null;
        let stats = GM_getValue('botStats', { completed: 0, earned: 0 });

        function saveStats() { GM_setValue('botStats', stats); }

        function getTaskType() {
            const el = document.querySelector('.list-item--title.task-item--title');
            if (!el) return null;
            const t = el.innerText || '';
            if (t.includes('Подписаться')) return {type: 'follow', name: 'Подписка'};
            if (t.includes('лайк') || t.includes('Like')) return {type: 'like', name: 'Лайк'};
            return null;
        }

        function hideCurrentTask() {
            const task = document.querySelector('.task-item--wrapper');
            if (!task) return false;
            const btn = task.querySelector('.btn--close') || task.querySelector('button[value="hide"]');
            if (btn) { btn.click(); console.log('🗑 Задание скрыто'); return true; }
            return false;
        }

        function checkAndHandleHideFlag() {
            const tt = getTaskType()?.type || 'follow';
            if (GM_getValue(`hide_task_${tt}`, false)) {
                GM_deleteValue(`hide_task_${tt}`);
                hideCurrentTask();
                return true;
            }
            if (localStorage.getItem('hide_current_task') === 'true') {
                localStorage.removeItem('hide_current_task');
                hideCurrentTask();
                return true;
            }
            return false;
        }

        function waitForToast(timeout = 15000) {
            return new Promise(resolve => {
                const obs = new MutationObserver(muts => {
                    for (const mut of muts) for (const node of mut.addedNodes) {
                        if (node.classList?.contains('toast')) {
                            const txt = node.innerText || '';
                            if (txt.includes('успешно') || txt.includes('зачислено')) resolve({success:true, error:false});
                            if (txt.includes('Упс') || txt.includes('не выполнили')) resolve({success:false, error:true});
                        }
                    }
                });
                obs.observe(document.body, {childList:true, subtree:true});
                setTimeout(() => { obs.disconnect(); resolve({success:false, error:false}); }, timeout);
            });
        }

        async function clickCheckAndWait(task, isRetry = false) {
            if (checkAndHandleHideFlag()) return false;

            const btn = document.querySelector('.btn--check');
            if (!btn) return false;

            btn.click();
            const result = await waitForToast();

            if (result.success) {
                stats.completed++; stats.earned += task.reward || 0; saveStats(); updateUI();
                GM_notification({title:'✅ Выполнено!', text: `+${task.reward} монет`, timeout:3000});
                // hide через форму
                const fd = new FormData();
                fd.append('UserPerformTask[id]', task.id);
                fd.append('UserPerformTask[task_execution_id]', task.execId);
                fd.append('UserPerformTask[nonce]', task.nonce);
                fd.append('UserPerformTask[submit]', 'hide');
                fetch('/lightning-action.php?action=tiktokfree_user_perform_task', {method:'POST', body:fd});
                if (task.wrapper) task.wrapper.remove();
                return true;
            } else if (result.error && isRetry) {
                hideCurrentTask();
                return false;
            } else if (result.error) {
                await delay(SETTINGS.retryDelay);
                return clickCheckAndWait(task, true);
            }
            return false;
        }

        // === ГЛАВНОЕ ИСПРАВЛЕНИЕ ===
        function waitForReturn(task) {
            return new Promise(resolve => {
                if (checkAndHandleHideFlag()) { resolve(false); return; }

                // Длинная начальная пауза — даём TikTok загрузиться
                console.log(`⏳ Ждём ${SETTINGS.initialWaitAfterOpen/1000} сек пока откроется TikTok...`);
                
                setTimeout(async () => {
                    if (checkAndHandleHideFlag()) { resolve(false); return; }

                    // Быстрые проверки после паузы
                    let checks = 0;
                    const fastCheck = setInterval(() => {
                        checks++;
                        if (checkAndHandleHideFlag()) { clearInterval(fastCheck); resolve(false); return; }
                        if (checks > 12) clearInterval(fastCheck);
                    }, 350);

                    const success = await clickCheckAndWait(task, false);
                    resolve(success);
                }, SETTINGS.initialWaitAfterOpen);
            });
        }

        function getTask() {
            const wrapper = document.querySelector('.task-item--wrapper');
            if (!wrapper) return null;
            const form = wrapper.querySelector('form');
            return {
                wrapper,
                id: form?.querySelector('input[name$="[id]"]')?.value,
                execId: form?.querySelector('input[name$="[task_execution_id]"]')?.value,
                nonce: form?.querySelector('input[name$="[nonce]"]')?.value,
                reward: parseFloat(wrapper.querySelector('.right')?.innerText.match(/[\d.]+/)?.[0] || 0),
                executeUrl: wrapper.querySelector('.btn--complete, .btn--complete2')?.href,
                taskType: getTaskType()
            };
        }

        function clickExecute(url, taskTypeObj) {
            localStorage.setItem('current_task_type', taskTypeObj?.type || 'follow');
            const sep = url.includes('?') ? '&' : '?';
            window.open(url + sep + 'task_type=' + (taskTypeObj?.type || 'follow'), '_blank');
        }

        async function doTask() {
            if (checkAndHandleHideFlag()) return false;

            const task = getTask();
            if (!task || !task.taskType) return false;

            console.log(`🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);

            return await waitForReturn(task);
        }

        async function startBot() {
            if (running) return;
            running = true;
            updateUI();
            console.log('\n🚀 БОТ ЗАПУЩЕН v4.7.0 — теперь ждёт загрузки TikTok');

            while (running) {
                const success = await doTask();
                if (success) console.log('✅ Задание засчитано');
                await delay(2000);

                if (!document.querySelector('.task-item--wrapper')) {
                    console.log('📭 Задания кончились — перезагрузка');
                    setTimeout(() => location.reload(), 6000);
                    break;
                }
            }
            running = false;
            updateUI();
        }

        function stopBot() {
            running = false;
            updateUI();
        }

        function resetStats() {
            stats = {completed:0, earned:0};
            saveStats();
            updateUI();
        }

        function updateUI() {
            document.getElementById('balance').innerText = document.querySelector('.user-balance')?.innerText || '0';
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
            const statusEl = document.getElementById('bot-status');
            statusEl.innerText = running ? 'РАБОТАЕТ' : 'СТОП';
            statusEl.style.background = running ? '#4caf50' : '#f44336';
        }

        // Панель
        const panel = document.createElement('div');
        panel.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;background:linear-gradient(135deg,#667eea,#764ba2);padding:12px;border-radius:12px;color:white;font-family:monospace;font-size:12px;min-width:250px;box-shadow:0 2px 10px rgba(0,0,0,0.3);`;
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><b>🤖 TikTokFree Bot 4.7</b><span id="bot-status" style="background:#f44336;padding:2px 8px;border-radius:20px;">СТОП</span></div>
            <div>💰 Баланс: <span id="balance">0</span></div>
            <div>✅ Выполнено: <span id="completed">0</span></div>
            <div>💎 Заработано: <span id="earned">0</span></div>
            <hr>
            <button id="start-btn" style="width:100%;padding:8px;margin:4px 0;background:#4caf50;border:none;border-radius:6px;color:white;cursor:pointer;">▶ СТАРТ</button>
            <button id="stop-btn" style="width:100%;padding:8px;margin:4px 0;background:#f44336;border:none;border-radius:6px;color:white;cursor:pointer;">⏹ СТОП</button>
            <button id="reset-stats" style="width:100%;padding:6px;margin:4px 0;background:#ff9800;border:none;border-radius:6px;color:white;cursor:pointer;font-size:11px;">🔄 Сброс статистики</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;

        updateUI();
        setTimeout(() => { if (!running) startBot(); }, SETTINGS.autoStartDelay);   // автозапуск

        console.log('✅ Bot v4.7.0 готов. Теперь должен ждать загрузки TikTok перед проверкой.');
    }
})();
