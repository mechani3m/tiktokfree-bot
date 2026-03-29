// ==UserScript==
// @name         TikTokFree Auto Bot Fixed
// @namespace    https://github.com/mechani3m/tiktokfree-bot
// @version      4.5.1
// @description  Исправлено: приоритетное скрытие задания при отсутствии кнопок лайка/подписки
// @author       mechani3m & Gemini
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
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    const isTikTok = location.hostname.includes('tiktok.com');
    const isTikTopFree = location.hostname.includes('tiktop-free.com');
    
    const SETTINGS = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        waitBeforeCloseFound: 15000,
        waitBeforeCloseNotFound: 500,
        autoStartDelay: 5000,
        checkDelayAfterReturn: 1500,
        retryDelay: 5000
    };
    
    // ========== TIKTOK ЛОГИКА ==========
    if (isTikTok) {
        console.log('🎯 TikTok Bot запущен');
        
        const urlParams = new URLSearchParams(location.search);
        const taskType = urlParams.get('task_type') || localStorage.getItem('current_task_type') || 'follow';
        
        function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        
        function sendStatusToSite(status, reason) {
            const statusUrl = 'https://tiktop-free.com/wp-admin/admin-ajax.php';
            GM_xmlhttpRequest({
                method: 'POST',
                url: statusUrl,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: `action=tikbot_status&status=${status}&reason=${reason}&task_type=${taskType}&t=${Date.now()}`
            });
        }

        async function findButton(type) {
            const selectors = type === 'follow' ? 
                ['[data-e2e="follow-button"]', 'button[aria-label*="Подписаться"]', 'button[aria-label*="Follow"]'] :
                ['[data-e2e="like-button"]', 'button[aria-label*="Нравится"]', 'button[aria-label*="Like"]', 'span[data-e2e="like-icon"]'];
            
            for (let i = 0; i < 6; i++) {
                for (const s of selectors) {
                    const btn = document.querySelector(s);
                    if (btn && btn.offsetParent !== null) return btn;
                }
                await delay(500);
            }
            return null;
        }
        
        async function runTikTok() {
            const button = await findButton(taskType);
            
            if (button) {
                console.log('✅ Кнопка найдена');
                sendStatusToSite('found', '');
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseFound);
            } else {
                console.log('❌ Кнопка НЕ НАЙДЕНА');
                // КРИТИЧЕСКИЙ МОМЕНТ: Пишем в Storage ПЕРЕД закрытием
                localStorage.setItem('hide_current_task', 'true');
                localStorage.setItem('hide_task_reason', `button_${taskType}_not_found`);
                sendStatusToSite('not_found', `button_${taskType}_not_found`);
                
                setTimeout(() => window.close(), SETTINGS.waitBeforeCloseNotFound);
            }
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runTikTok);
        else runTikTok();
        return;
    }
    
    // ========== TIKTOPFREE ЛОГИКА ==========
    if (isTikTopFree) {
        let running = false;
        let pendingHide = false;
        let stats = GM_getValue('botStats', { completed: 0, earned: 0 });
        let checkInterval = null;

        function hideCurrentTask() {
            const task = document.querySelector('.task-item--wrapper');
            if (!task) return false;
            const hideBtn = task.querySelector('.btn--close') || task.querySelector('button[value="hide"]');
            if (hideBtn) {
                hideBtn.click();
                console.log('🗑 Задание скрыто по требованию бота');
                return true;
            }
            return false;
        }

        function checkAndHandleHideFlag() {
            const needHide = localStorage.getItem('hide_current_task') === 'true';
            if (needHide || pendingHide) {
                pendingHide = false;
                localStorage.removeItem('hide_current_task');
                hideCurrentTask();
                return true;
            }
            return false;
        }

        async function clickCheckAndWait(task, isRetry = false) {
            // Проверка флага ПЕРЕД нажатием "Проверить"
            if (checkAndHandleHideFlag()) return false;

            const checkBtn = document.querySelector('.btn--check');
            if (!checkBtn) return false;
            
            checkBtn.click();
            
            return new Promise((resolve) => {
                const observer = new MutationObserver((mutations, obs) => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node.classList?.contains('toast')) {
                                const text = node.innerText;
                                if (text.includes('успешно') || text.includes('зачислено')) {
                                    obs.disconnect();
                                    stats.completed++;
                                    stats.earned += task.reward;
                                    GM_setValue('botStats', stats);
                                    updateUI();
                                    resolve(true);
                                } else if (text.includes('Упс') || text.includes('не выполнили')) {
                                    obs.disconnect();
                                    if (isRetry) {
                                        hideCurrentTask();
                                        resolve(false);
                                    } else {
                                        setTimeout(() => resolve(clickCheckAndWait(task, true)), SETTINGS.retryDelay);
                                    }
                                }
                            }
                        }
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve(false); }, 15000);
            });
        }

        function waitForReturn(task) {
            return new Promise((resolve) => {
                let resolved = false;
                if (checkInterval) clearInterval(checkInterval);
                
                checkInterval = setInterval(async () => {
                    // Если прилетел флаг "не найдено" — сразу выходим без клика по "Проверить"
                    if (checkAndHandleHideFlag()) {
                        clearInterval(checkInterval);
                        resolved = true;
                        resolve(false);
                    }

                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearInterval(checkInterval);
                        setTimeout(async () => {
                            if (checkAndHandleHideFlag()) resolve(false);
                            else resolve(await clickCheckAndWait(task));
                        }, SETTINGS.checkDelayAfterReturn);
                    }
                }, 200);
            });
        }

        async function doTask() {
            const wrapper = document.querySelector('.task-item--wrapper');
            if (!wrapper) return false;

            // Очищаем старые флаги перед началом
            localStorage.removeItem('hide_current_task');
            
            const task = {
                wrapper,
                reward: parseFloat(wrapper.querySelector('.btn--complete .right, .btn--complete2 .right')?.innerText.match(/[\d\.]+/)[0] || 0),
                executeUrl: wrapper.querySelector('.btn--complete2, .btn--complete')?.href,
                type: (wrapper.querySelector('.task-item--title')?.innerText.includes('Подписаться')) ? 'follow' : 'like'
            };

            if (!task.executeUrl) return false;

            localStorage.setItem('current_task_type', task.type);
            window.open(`${task.executeUrl}${task.executeUrl.includes('?') ? '&' : '?'}task_type=${task.type}`, '_blank');
            
            return await waitForReturn(task);
        }

        // --- Интерфейс ---
        const panel = document.createElement('div');
        panel.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;background:linear-gradient(135deg,#667eea,#764ba2);padding:12px;border-radius:12px;color:white;font-family:sans-serif;font-size:12px;min-width:200px;box-shadow:0 4px 15px rgba(0,0,0,0.3);`;
        panel.innerHTML = `<b>🤖 TikTokFree Bot</b><br>✅ Выполнено: <span id="completed">0</span><br>💎 Заработано: <span id="earned">0</span><br><button id="start-btn" style="width:100%;margin-top:8px;background:#4caf50;border:none;color:white;padding:5px;border-radius:4px;cursor:pointer">СТАРТ</button>`;
        document.body.appendChild(panel);

        function updateUI() {
            document.getElementById('completed').innerText = stats.completed;
            document.getElementById('earned').innerText = stats.earned.toFixed(2);
        }

        document.getElementById('start-btn').onclick = async () => {
            if (running) return;
            running = true;
            document.getElementById('start-btn').innerText = "РАБОТАЕТ...";
            while(running) {
                await doTask();
                await new Promise(r => setTimeout(r, 2000));
                if (!document.querySelector('.task-item--wrapper')) location.reload();
            }
        };
        updateUI();
    }
})();
