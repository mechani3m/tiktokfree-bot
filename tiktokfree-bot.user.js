// ==UserScript==
// @name         TikTokFree Auto Bot
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      6.0.0
// @description  Профессиональная версия: гарантированное скрытие при ненайденной кнопке
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
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
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
        waitBeforeCloseNotFound: 100,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 1000
    };
    
    // ========== TIKTOK ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot v6.0 запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || GM_getValue('current_task_type', 'follow');
        let buttonFound = false;
        let statusSent = false;
        
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
        
        // ПРИНУДИТЕЛЬНАЯ ОТПРАВКА СТАТУСА
        function sendHideStatus() {
            if (statusSent) return;
            statusSent = true;
            
            console.log('📡 ОТПРАВЛЯЮ СТАТУС СКРЫТИЯ');
            
            // Способ 1: GM_setValue
            GM_setValue('hide_current_task', 'true');
            GM_setValue('hide_task_reason', `button_${taskType}_not_found`);
            GM_setValue('hide_task_timestamp', Date.now());
            
            // Способ 2: sessionStorage (для той же вкладки)
            sessionStorage.setItem('hide_current_task', 'true');
            
            // Способ 3: localStorage
            localStorage.setItem('hide_current_task', 'true');
            
            // Способ 4: cookie
            document.cookie = `hide_current_task=true; path=/; max-age=60`;
            
            console.log('✅ Статус скрытия отправлен всеми способами');
        }
        
        async function findFollowButton() {
            const selectors = [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]'
            ];
            
            for (let attempt = 0; attempt < 5; attempt++) {
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
                
                await delay(300);
            }
            return null;
        }
        
        async function findLikeButton() {
            const selectors = [
                '[data-e2e="like-button"]',
                'button[aria-label*="Нравится"]',
                'button[aria-label*="Like"]',
                'span[data-e2e="like-icon"]'
            ];
            
            for (let attempt = 0; attempt < 5; attempt++) {
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
                
                await delay(300);
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
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #0a0; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `✅ Кнопка найдена!`;
                document.body.appendChild(indicator);
                
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseFound);
                
            } else {
                buttonFound = false;
                console.log(`❌ Кнопка ${taskType} НЕ НАЙДЕНА!`);
                sendWebhook(`/${taskType}_not_found`, { buttonFound: false });
                
                // ОТПРАВЛЯЕМ СТАТУС СКРЫТИЯ
                sendHideStatus();
                
                const indicator = document.createElement('div');
                indicator.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: #a00; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px;`;
                indicator.innerHTML = `❌ Кнопка НЕ найдена! Задание будет скрыто`;
                document.body.appendChild(indicator);
                
                // БЫСТРОЕ ЗАКРЫТИЕ
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseNotFound);
            }
        }
        
        // ЗАПУСКАЕМ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
        
        return;
    }
    
    // ========== TIKTOPFREE ==========
    if (isTikTopFree) {
        console.log('🤖 TikTokFree Bot v6.0 запущен');
        
        let running = false;
        let autoStartTimer = null;
        let stats = { completed: 0, earned: 0 };
        let checkInterval = null;
        
        // Загружаем статистику
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
        
        // ГЛАВНАЯ ФУНКЦИЯ ПРОВЕРКИ СКРЫТИЯ
        function shouldHideTask() {
            // Проверяем все возможные источники
            const gmHide = GM_getValue('hide_current_task', null);
            const sessionHide = sessionStorage.getItem('hide_current_task');
            const localHide = localStorage.getItem('hide_current_task');
            const cookieHide = document.cookie.includes('hide_current_task=true');
            
            if (gmHide === 'true' || sessionHide === 'true' || localHide === 'true' || cookieHide) {
                console.log('⚠️ ОБНАРУЖЕН ФЛАГ СКРЫТИЯ!');
                console.log('  GM:', gmHide);
                console.log('  session:', sessionHide);
                console.log('  local:', localHide);
                console.log('  cookie:', cookieHide);
                
                // Очищаем все флаги
                GM_deleteValue('hide_current_task');
                sessionStorage.removeItem('hide_current_task');
                localStorage.removeItem('hide_current_task');
                document.cookie = 'hide_current_task=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                
                return true;
            }
            return false;
        }
        
        // Функция ожидания тоста
        function waitForToast(timeout = 10000) {
            return new Promise((resolve) => {
                const checkExisting = () => {
                    const toasts = document.querySelectorAll('.toast');
                    for (const toast of toasts) {
                        const text = toast.innerText;
                        if (text.includes('успешно') || text.includes('зачислено')) {
                            resolve({ success: true, text });
                            return true;
                        }
                        if (text.includes('Упс')) {
                            resolve({ success: false, error: true, text });
                            return true;
                        }
                    }
                    return false;
                };
                
                if (checkExisting()) return;
                
                let observer = new MutationObserver(() => {
                    if (checkExisting()) observer.disconnect();
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                setTimeout(() => {
                    observer.disconnect();
                    resolve({ success: false, error: false, text: null });
                }, timeout);
            });
        }
        
        // Нажать "Проверить" и ждать результат
        async function clickCheck(task) {
            console.log('🔍 Нажимаю "Проверить"...');
            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;
            
            checkBtn.click();
            
            const result = await waitForToast(10000);
            
            if (result.success) {
                console.log(`✅ ВЫПОЛНЕНО! +${task.reward} монет`);
                stats.completed++;
                stats.earned += task.reward;
                saveStats();
                updateUI();
                
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
                
                GM_notification({ title: '✅ Выполнено!', text: `+${task.reward} монет`, timeout: 2000 });
                return true;
            }
            
            if (result.error) {
                console.log('❌ Ошибка выполнения, скрываю задание');
                hideCurrentTask();
                return false;
            }
            
            console.log('❌ Нет ответа');
            return false;
        }
        
        // Ждем возврата и проверяем флаг
        function waitForReturn(task) {
            return new Promise((resolve) => {
                let resolved = false;
                
                const interval = setInterval(() => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(interval);
                        console.log('👀 Возврат на сайт!');
                        
                        // ПРОВЕРЯЕМ ФЛАГ СКРЫТИЯ (САМОЕ ГЛАВНОЕ)
                        if (shouldHideTask()) {
                            console.log('✅ Флаг найден! Скрываю задание без проверки');
                            hideCurrentTask();
                            resolve(false);
                            return;
                        }
                        
                        // Если флага нет, проверяем задание
                        setTimeout(async () => {
                            const success = await clickCheck(task);
                            resolve(success);
                        }, SETTINGS.checkDelayAfterReturn);
                    }
                }, 100);
                
                setTimeout(() => {
                    if (!resolved) {
                        clearInterval(interval);
                        console.log('⏰ Таймаут');
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
            
            console.log(`\n🎯 ${task.taskType.name} | +${task.reward} монет`);
            clickExecute(task.executeUrl, task.taskType);
            
            return await waitForReturn(task);
        }
        
        // UI панель
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 12px; border-radius: 12px; color: white;
            font-family: monospace; font-size: 12px; min-width: 200px;
        `;
        panel.innerHTML = `
            <div><b>🤖 TikTokFree Bot v6.0</b> <span id="bot-status" style="background:#f44336;padding:2px 8px;border-radius:20px;">СТОП</span></div>
            <div>💰 <span id="balance">0</span> | ✅ <span id="completed">0</span> | 💎 <span id="earned">0</span></div>
            <button id="start-btn" style="margin-top:8px;width:100%;background:#4caf50;border:none;border-radius:6px;padding:6px;color:white;">▶ СТАРТ</button>
            <button id="stop-btn" style="margin-top:4px;width:100%;background:#f44336;border:none;border-radius:6px;padding:6px;color:white;">⏹ СТОП</button>
            <button id="reset-stats" style="margin-top:4px;width:100%;background:#ff9800;border:none;border-radius:6px;padding:4px;font-size:10px;color:white;">🔄 Сброс</button>
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
            console.log('\n🚀 БОТ ЗАПУЩЕН v6.0');
            console.log('📌 Если кнопка не найдена → задание СКРЫВАЕТСЯ мгновенно\n');
            
            let count = 0;
            while (running && count < 100) {
                const success = await doTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 1500));
                if (!document.querySelector('.task-item--wrapper')) {
                    location.reload();
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
            console.log('🛑 Остановлен');
        }
        
        function resetStats() {
            stats = { completed: 0, earned: 0 };
            saveStats();
            updateUI();
        }
        
        document.getElementById('start-btn').onclick = startBot;
        document.getElementById('stop-btn').onclick = stopBot;
        document.getElementById('reset-stats').onclick = resetStats;
        
        window.botStats = () => console.log(`✅ ${stats.completed} | 💎 ${stats.earned.toFixed(2)}`);
        
        updateUI();
        
        // Автозапуск
        setTimeout(() => {
            if (!running) startBot();
        }, SETTINGS.autoStartDelay);
        
        console.log('✅ Бот готов! botStats() - статистика');
    }
})();
