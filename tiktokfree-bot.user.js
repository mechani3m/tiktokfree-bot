// ==UserScript==
// @name         TikTokFree Auto Bot + TikTok Subscriber
// @namespace    https://github.com/YOUR_USERNAME/tiktokfree-bot
// @version      2.1.0
// @description  Автоматическое выполнение заданий на tiktop-free.com + поиск и нажатие кнопки подписки в TikTok
// @author       YOUR_NAME
// @match        https://tiktop-free.com/tasks/*
// @match        https://tiktop-free.com/tasks
// @match        https://www.tiktok.com/*
// @match        https://m.tiktok.com/*
// @icon         https://tiktop-free.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      trigger.macrodroid.com
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/YOUR_USERNAME/tiktokfree-bot/main/tiktokfree-bot.user.js
// @updateURL    https://raw.githubusercontent.com/YOUR_USERNAME/tiktokfree-bot/main/tiktokfree-bot.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // Определяем на каком мы сайте
    const isTikTok = window.location.hostname.includes('tiktok.com');
    const isTikTopFree = window.location.hostname.includes('tiktop-free.com');
    
    // ========== КОНФИГУРАЦИЯ ==========
    const CONFIG = {
        webhookUrl: GM_getValue('webhookUrl', 'https://trigger.macrodroid.com/e4e9515c-9214-454b-83c2-f81eb88e356d'),
        autoStart: GM_getValue('autoStart', false),
        checkDelay: 3000,
        maxTasksPerSession: GM_getValue('maxTasks', 100),
        soundOnComplete: GM_getValue('sound', true),
        autoCloseTab: GM_getValue('autoCloseTab', true),
        waitBeforeClose: GM_getValue('waitBeforeClose', 10000),
        autoClickButton: GM_getValue('autoClickButton', true),
        
        selectors: {
            taskWrapper: '.task-item--wrapper',
            executeBtn: '.btn--complete2',
            executeAlt: '.btn--complete',
            checkBtn: '.btn--check',
            closeBtn: '.btn--close',
            balance: '.user-balance'
        },
        
        tiktokSelectors: {
            follow: [
                '[data-e2e="follow-button"]',
                'button[aria-label*="Подписаться"]',
                'button[aria-label*="Follow"]',
                'button[class*="follow"]',
                'div[data-e2e="follow-button"] button',
                '[class*="FollowButton"] button',
                'button[class*="FollowButton"]',
                'button:has(span:contains("Подписаться"))'
            ],
            like: [
                '[data-e2e="like-button"]',
                'button[aria-label*="Нравится"]',
                'button[aria-label*="Like"]',
                'span[data-e2e="like-icon"]',
                'button[class*="like"]'
            ]
        }
    };
    
    // ========== TIKTOK СКРИПТ ==========
    if (isTikTok) {
        console.log('%c🎯 TikTok Auto Bot v2.1 запущен', 'color: #00ff00; font-size: 14px');
        console.log('📍 Сайт: TikTok');
        console.log('📍 URL:', window.location.href);
        
        // Генерируем ID задачи
        const taskId = Date.now().toString();
        
        // Функция ожидания загрузки страницы
        function waitForPageLoad() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
        }
        
        // Функция ожидания появления элемента
        function waitForElement(selectors, timeout = 10000) {
            return new Promise((resolve) => {
                const startTime = Date.now();
                
                function check() {
                    for (const selector of selectors) {
                        try {
                            const element = document.querySelector(selector);
                            if (element && element.offsetParent !== null) {
                                resolve(element);
                                return;
                            }
                        } catch(e) {}
                    }
                    
                    if (Date.now() - startTime > timeout) {
                        resolve(null);
                        return;
                    }
                    
                    setTimeout(check, 500);
                }
                
                check();
            });
        }
        
        // Функция поиска кнопки с ожиданием
        async function findButtonWithWait(type) {
            const selectors = type === 'follow' ? CONFIG.tiktokSelectors.follow : CONFIG.tiktokSelectors.like;
            console.log(`🔍 Ожидаю появление кнопки ${type}...`);
            
            const button = await waitForElement(selectors, 10000);
            
            if (button) {
                console.log(`✅ Найдена кнопка ${type}:`, button);
                return button;
            }
            
            // Альтернативный поиск по тексту
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = btn.innerText?.toLowerCase() || '';
                if (type === 'follow' && (text.includes('подписаться') || text.includes('follow'))) {
                    console.log(`✅ Найдена кнопка по тексту: "${btn.innerText}"`);
                    return btn;
                }
                if (type === 'like' && (text.includes('нравится') || text.includes('like'))) {
                    console.log(`✅ Найдена кнопка по тексту: "${btn.innerText}"`);
                    return btn;
                }
            }
            
            console.log(`❌ Кнопка ${type} не найдена за 10 секунд`);
            return null;
        }
        
        // Функция отправки вебхука (с ожиданием ответа)
        function sendWebhook(action, data = {}) {
            return new Promise((resolve) => {
                const url = CONFIG.webhookUrl + action;
                console.log(`📡 Отправка вебхука: ${action}`);
                console.log(`📡 URL: ${url}`);
                console.log(`📡 Данные:`, data);
                
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        taskId: taskId,
                        action: action,
                        ...data
                    }),
                    onload: function(response) {
                        console.log(`✅ Вебхук ${action} отправлен, статус: ${response.status}`);
                        resolve(true);
                    },
                    onerror: function(error) {
                        console.log(`⚠️ Ошибка отправки вебхука ${action}:`, error);
                        resolve(false);
                    }
                });
            });
        }
        
        // Функция уведомления основного скрипта
        function notifyMainScript() {
            console.log('🔔 Отправляем сигнал основному скрипту...');
            
            // Отправляем вебхук о завершении
            sendWebhook('/task_completed', {
                taskId: taskId,
                message: 'Задание выполнено, можно проверять'
            });
            
            // Сохраняем в localStorage
            localStorage.setItem('tikbot_task_completed', 'true');
            localStorage.setItem('tikbot_task_id', taskId);
            localStorage.setItem('tikbot_completed_time', Date.now());
            
            // Отправляем сообщение родительской вкладке
            if (window.opener && !window.opener.closed) {
                try {
                    window.opener.postMessage({
                        type: 'TIKTOK_TASK_COMPLETED',
                        taskId: taskId,
                        timestamp: Date.now(),
                        source: 'tiktok-bot'
                    }, 'https://tiktop-free.com');
                    console.log('✅ Сообщение отправлено родительской вкладке');
                } catch(e) {
                    console.log('⚠️ Не удалось отправить postMessage:', e);
                }
            }
        }
        
        // Определяем тип страницы
        const isProfilePage = window.location.pathname.includes('/@') || 
                              window.location.pathname.includes('/user/');
        const isVideoPage = window.location.pathname.includes('/video/');
        
        // Основная функция
        async function runTikTokBot() {
            console.log('🎬 Ожидаем полную загрузку страницы...');
            
            // Ждем полной загрузки страницы
            await waitForPageLoad();
            console.log('✅ Страница полностью загружена');
            
            // Дополнительная задержка для динамического контента
            await new Promise(r => setTimeout(r, 2000));
            console.log('✅ Дополнительная задержка завершена');
            
            let button = null;
            let action = '';
            let buttonFound = false;
            
            if (isProfilePage) {
                action = 'follow';
                console.log('📱 Определен тип: СТРАНИЦА ПРОФИЛЯ - ищем кнопку подписки');
                button = await findButtonWithWait('follow');
                if (button) buttonFound = true;
                
            } else if (isVideoPage) {
                action = 'like';
                console.log('📱 Определен тип: СТРАНИЦА ВИДЕО - ищем кнопку лайка');
                button = await findButtonWithWait('like');
                if (button) buttonFound = true;
                
            } else {
                console.log('⚠️ Неизвестный тип страницы');
                await sendWebhook('/unknown_page', { url: window.location.href });
            }
            
            // ОТПРАВЛЯЕМ ВЕБХУК С РЕЗУЛЬТАТОМ ПОИСКА
            await sendWebhook(`/${action}_search`, {
                found: buttonFound,
                pageType: isProfilePage ? 'profile' : (isVideoPage ? 'video' : 'unknown'),
                url: window.location.href,
                timestamp: Date.now()
            });
            
            if (button && buttonFound) {
                console.log(`🎯 Кнопка ${action} найдена!`);
                
                // Отправляем вебхук о том, что кнопка найдена
                await sendWebhook(`/${action}_found`, {
                    buttonText: button.innerText || button.textContent || 'неизвестно',
                    buttonHtml: button.outerHTML.substring(0, 200)
                });
                
                // Нажимаем кнопку (если включено в настройках)
                if (CONFIG.autoClickButton) {
                    console.log(`🤖 Автоматически нажимаю кнопку ${action}...`);
                    button.click();
                    console.log(`✅ Кнопка ${action} нажата!`);
                    
                    // Отправляем вебхук о нажатии
                    await sendWebhook(`/${action}_clicked`, {
                        success: true,
                        timestamp: Date.now()
                    });
                } else {
                    console.log(`⚠️ Автонажатие отключено, кнопка не нажата`);
                    await sendWebhook(`/${action}_not_clicked`, {
                        reason: 'autoClickButton disabled'
                    });
                }
                
            } else {
                console.log(`⚠️ Кнопка ${action} НЕ найдена`);
                await sendWebhook(`/${action}_not_found`, {
                    url: window.location.href,
                    reason: 'button not found after wait'
                });
            }
            
            // Ждем перед закрытием
            console.log(`⏳ Ждем ${CONFIG.waitBeforeClose / 1000} секунд перед закрытием...`);
            await new Promise(r => setTimeout(r, CONFIG.waitBeforeClose));
            
            // ОТПРАВЛЯЕМ ФИНАЛЬНЫЙ ВЕБХУК О ЗАВЕРШЕНИИ
            await sendWebhook('/task_completed', {
                action: action,
                buttonFound: buttonFound,
                buttonClicked: buttonFound && CONFIG.autoClickButton,
                waitTime: CONFIG.waitBeforeClose,
                timestamp: Date.now()
            });
            
            // Уведомляем основной скрипт
            notifyMainScript();
            
            // Закрываем вкладку
            if (CONFIG.autoCloseTab) {
                console.log('🔚 Закрываю вкладку через 1 секунду...');
                await new Promise(r => setTimeout(r, 1000));
                window.close();
            } else {
                console.log('💡 Вкладка не закрыта (autoCloseTab = false)');
                // Перенаправляем обратно на сайт
                window.location.href = 'https://tiktop-free.com/tasks/';
            }
        }
        
        // Запускаем скрипт
        runTikTokBot();
        
        // Добавляем визуальный индикатор
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9999;
            background: linear-gradient(135deg, #00ff00, #009900);
            color: black;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-family: monospace;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: pulse 1s infinite;
        `;
        indicator.innerHTML = '🤖 TikTok Bot ACTIVE<br>🔄 Автонажатие включено';
        document.body.appendChild(indicator);
        
        // Добавляем стиль анимации
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        return; // Останавливаем выполнение
    }
    
    // ========== TIKTOPFREE СКРИПТ ==========
    if (isTikTopFree) {
        console.log('%c🤖 TikTokFree Bot v2.1 загружен', 'color: #00ff00; font-size: 14px');
        console.log('📍 Сайт: TikTopFree');
        
        let botState = {
            isRunning: false,
            currentTask: null,
            stats: {
                completed: 0,
                failed: 0,
                earned: 0,
                startTime: null
            }
        };
        
        // ========== СОЗДАНИЕ UI ==========
        function createUI() {
            const style = document.createElement('style');
            style.textContent = `
                .tikbot-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 16px;
                    padding: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    color: white;
                    min-width: 280px;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }
                .tikbot-panel.minimized {
                    min-width: auto;
                    padding: 8px 12px;
                }
                .tikbot-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    margin-bottom: 8px;
                }
                .tikbot-title {
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .tikbot-status {
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.2);
                }
                .tikbot-status.running {
                    background: #4caf50;
                    animation: pulse 1.5s infinite;
                }
                .tikbot-status.stopped {
                    background: #f44336;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.6; }
                    100% { opacity: 1; }
                }
                .tikbot-content {
                    transition: all 0.3s ease;
                }
                .tikbot-content.hidden {
                    display: none;
                }
                .tikbot-stats {
                    background: rgba(0,0,0,0.3);
                    border-radius: 8px;
                    padding: 8px;
                    margin: 8px 0;
                    font-size: 12px;
                }
                .tikbot-stats div {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                }
                .tikbot-buttons {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .tikbot-btn {
                    flex: 1;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                    font-size: 12px;
                }
                .tikbot-btn-start {
                    background: #4caf50;
                    color: white;
                }
                .tikbot-btn-stop {
                    background: #f44336;
                    color: white;
                }
                .tikbot-btn-config {
                    background: rgba(255,255,255,0.2);
                    color: white;
                }
                .tikbot-btn:hover {
                    transform: scale(1.02);
                    filter: brightness(1.1);
                }
                .tikbot-settings {
                    margin-top: 8px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 8px;
                    padding: 8px;
                }
                .tikbot-settings.hidden {
                    display: none;
                }
                .tikbot-settings input, .tikbot-settings select {
                    width: 100%;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: none;
                    margin: 4px 0;
                    font-size: 12px;
                }
                .tikbot-settings label {
                    font-size: 11px;
                    display: block;
                    margin-top: 6px;
                }
                .tikbot-debug {
                    margin-top: 8px;
                    font-size: 10px;
                    background: rgba(0,0,0,0.5);
                    border-radius: 8px;
                    padding: 6px;
                    max-height: 100px;
                    overflow-y: auto;
                    font-family: monospace;
                }
                .tikbot-debug.hidden {
                    display: none;
                }
            `;
            document.head.appendChild(style);
            
            const panel = document.createElement('div');
            panel.className = 'tikbot-panel';
            panel.innerHTML = `
                <div class="tikbot-header">
                    <div class="tikbot-title">
                        <span>🤖</span>
                        <span>TikTokFree Bot</span>
                        <span style="font-size: 10px;" id="tikbot-version">v2.1</span>
                    </div>
                    <div class="tikbot-status ${botState.isRunning ? 'running' : 'stopped'}">
                        ${botState.isRunning ? 'РАБОТАЕТ' : 'СТОП'}
                    </div>
                </div>
                <div class="tikbot-content">
                    <div class="tikbot-stats">
                        <div><span>💰 Баланс:</span><span id="tikbot-balance">0</span></div>
                        <div><span>✅ Выполнено:</span><span id="tikbot-completed">0</span></div>
                        <div><span>💎 Заработано:</span><span id="tikbot-earned">0</span></div>
                        <div><span>⏱ Время:</span><span id="tikbot-time">00:00</span></div>
                    </div>
                    <div class="tikbot-buttons">
                        <button class="tikbot-btn tikbot-btn-start" id="tikbot-start">▶ СТАРТ</button>
                        <button class="tikbot-btn tikbot-btn-stop" id="tikbot-stop">⏹ СТОП</button>
                        <button class="tikbot-btn tikbot-btn-config" id="tikbot-config">⚙</button>
                    </div>
                    <div class="tikbot-settings hidden" id="tikbot-settings">
                        <input type="text" id="tikbot-webhook" placeholder="Webhook URL" value="${CONFIG.webhookUrl}">
                        <label>
                            <input type="checkbox" id="tikbot-autostart" ${CONFIG.autoStart ? 'checked' : ''}>
                            Автозапуск при загрузке
                        </label>
                        <label>
                            <input type="checkbox" id="tikbot-sound" ${CONFIG.soundOnComplete ? 'checked' : ''}>
                            Звук при выполнении
                        </label>
                        <label>
                            <input type="checkbox" id="tikbot-auto-click" ${CONFIG.autoClickButton ? 'checked' : ''}>
                            Автонажатие кнопки в TikTok
                        </label>
                        <label>
                            <input type="checkbox" id="tikbot-close-tab" ${CONFIG.autoCloseTab ? 'checked' : ''}>
                            Закрывать вкладку TikTok
                        </label>
                        <label>Ждать перед закрытием (сек): 
                            <input type="number" id="tikbot-wait-close" value="${CONFIG.waitBeforeClose / 1000}" style="width: 60px;">
                        </label>
                        <label>Макс заданий: 
                            <input type="number" id="tikbot-max" value="${CONFIG.maxTasksPerSession}" style="width: 60px;">
                        </label>
                        <button class="tikbot-btn" id="tikbot-save" style="margin-top: 8px;">💾 Сохранить</button>
                    </div>
                    <div class="tikbot-debug hidden" id="tikbot-debug">
                        <div id="tikbot-log"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
            
            const header = panel.querySelector('.tikbot-header');
            const content = panel.querySelector('.tikbot-content');
            let minimized = false;
            header.onclick = (e) => {
                if (e.target.closest('.tikbot-btn')) return;
                minimized = !minimized;
                if (minimized) {
                    content.classList.add('hidden');
                    panel.classList.add('minimized');
                } else {
                    content.classList.remove('hidden');
                    panel.classList.remove('minimized');
                }
            };
            
            document.getElementById('tikbot-start').onclick = () => startBot();
            document.getElementById('tikbot-stop').onclick = () => stopBot();
            document.getElementById('tikbot-config').onclick = () => {
                const settings = document.getElementById('tikbot-settings');
                settings.classList.toggle('hidden');
            };
            document.getElementById('tikbot-save').onclick = () => saveSettings();
            
            setInterval(() => updateUI(), 1000);
            updateUI();
            
            window.tikbotLog = function(msg) {
                const logDiv = document.getElementById('tikbot-log');
                if (logDiv) {
                    const time = new Date().toLocaleTimeString();
                    logDiv.innerHTML = `<div>[${time}] ${msg}</div>` + logDiv.innerHTML;
                    if (logDiv.children.length > 20) {
                        logDiv.removeChild(logDiv.lastChild);
                    }
                }
                console.log(msg);
            };
        }
        
        function updateUI() {
            const balance = document.querySelector(CONFIG.selectors.balance)?.innerText || '0';
            document.getElementById('tikbot-balance').innerText = balance;
            document.getElementById('tikbot-completed').innerText = botState.stats.completed;
            document.getElementById('tikbot-earned').innerText = botState.stats.earned.toFixed(2);
            
            if (botState.stats.startTime) {
                const elapsed = Math.floor((Date.now() - botState.stats.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('tikbot-time').innerText = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
            }
            
            const statusEl = document.querySelector('.tikbot-status');
            if (statusEl) {
                statusEl.className = `tikbot-status ${botState.isRunning ? 'running' : 'stopped'}`;
                statusEl.innerText = botState.isRunning ? 'РАБОТАЕТ' : 'СТОП';
            }
        }
        
        function saveSettings() {
            CONFIG.webhookUrl = document.getElementById('tikbot-webhook').value;
            CONFIG.autoStart = document.getElementById('tikbot-autostart').checked;
            CONFIG.soundOnComplete = document.getElementById('tikbot-sound').checked;
            CONFIG.autoClickButton = document.getElementById('tikbot-auto-click').checked;
            CONFIG.autoCloseTab = document.getElementById('tikbot-close-tab').checked;
            CONFIG.waitBeforeClose = parseInt(document.getElementById('tikbot-wait-close').value) * 1000 || 10000;
            CONFIG.maxTasksPerSession = parseInt(document.getElementById('tikbot-max').value) || 100;
            
            GM_setValue('webhookUrl', CONFIG.webhookUrl);
            GM_setValue('autoStart', CONFIG.autoStart);
            GM_setValue('sound', CONFIG.soundOnComplete);
            GM_setValue('autoClickButton', CONFIG.autoClickButton);
            GM_setValue('autoCloseTab', CONFIG.autoCloseTab);
            GM_setValue('waitBeforeClose', CONFIG.waitBeforeClose);
            GM_setValue('maxTasks', CONFIG.maxTasksPerSession);
            
            window.tikbotLog('✅ Настройки сохранены');
            GM_notification({ title: 'Настройки сохранены', text: 'Конфигурация обновлена', timeout: 2000 });
        }
        
        // ========== ВЕБХУКИ ==========
        function sendWebhook(action, data = {}) {
            const url = CONFIG.webhookUrl + action;
            window.tikbotLog(`📡 Вебхук: ${action}`);
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    action: action,
                    stats: botState.stats,
                    ...data
                })
            });
        }
        
        function playSound() {
            if (!CONFIG.soundOnComplete) return;
            try {
                const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                audio.volume = 0.3;
                audio.play().catch(e => {});
            } catch(e) {}
        }
        
        // ========== СЛУШАТЕЛЬ СООБЩЕНИЙ ==========
        function setupMessageListener() {
            window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'TIKTOK_TASK_COMPLETED') {
                    window.tikbotLog('📨 Получен сигнал о завершении задания от TikTok!');
                    window.tikbotLog('🔍 Автоматически проверяю задание...');
                    
                    setTimeout(() => {
                        const checkBtn = document.querySelector(CONFIG.selectors.checkBtn);
                        if (checkBtn) {
                            checkBtn.click();
                            window.tikbotLog('✅ Кнопка "Проверить" нажата автоматически');
                        } else {
                            window.tikbotLog('❌ Кнопка "Проверить" не найдена');
                        }
                    }, 1000);
                }
            });
            
            // Также проверяем localStorage
            setInterval(() => {
                const completed = localStorage.getItem('tikbot_task_completed');
                if (completed === 'true') {
                    window.tikbotLog('📨 Обнаружено завершение задания в localStorage!');
                    const checkBtn = document.querySelector(CONFIG.selectors.checkBtn);
                    if (checkBtn) {
                        checkBtn.click();
                        window.tikbotLog('✅ Кнопка "Проверить" нажата автоматически');
                    }
                    localStorage.removeItem('tikbot_task_completed');
                }
            }, 1000);
            
            window.tikbotLog('📡 Слушатель сообщений запущен');
        }
        
        // ========== ОСНОВНАЯ ЛОГИКА ==========
        function getCurrentTask() {
            const wrapper = document.querySelector(CONFIG.selectors.taskWrapper);
            if (!wrapper) return null;
            
            const form = wrapper.querySelector('form');
            if (!form) return null;
            
            const idInput = form.querySelector('input[name$="[id]"]');
            const execInput = form.querySelector('input[name$="[task_execution_id]"]');
            const nonceInput = form.querySelector('input[name$="[nonce]"]');
            
            if (!idInput || !execInput || !nonceInput) return null;
            
            const rewardSpan = wrapper.querySelector('.btn--complete .right, .btn--complete2 .right');
            let reward = 0;
            if (rewardSpan) {
                const match = rewardSpan.innerText.match(/[\d\.]+/);
                if (match) reward = parseFloat(match[0]);
            }
            
            const executeBtn = wrapper.querySelector(CONFIG.selectors.executeBtn);
            const executeAlt = wrapper.querySelector(CONFIG.selectors.executeAlt);
            
            return {
                element: wrapper,
                id: idInput.value,
                execId: execInput.value,
                nonce: nonceInput.value,
                reward: reward,
                executeUrl: executeBtn?.href || executeAlt?.href
            };
        }
        
        function clickExecute() {
            const task = getCurrentTask();
            if (!task?.executeUrl) return false;
            
            window.tikbotLog(`🔘 Открываю TikTok: ${task.executeUrl.substring(0, 50)}...`);
            sendWebhook('/open', { url: task.executeUrl, reward: task.reward });
            window.open(task.executeUrl, '_blank');
            return true;
        }
        
        async function clickCheck(task) {
            const formData = new FormData();
            formData.append('UserPerformTask[id]', task.id);
            formData.append('UserPerformTask[task_execution_id]', task.execId);
            formData.append('UserPerformTask[nonce]', task.nonce);
            formData.append('UserPerformTask[submit]', 'check');
            
            try {
                const response = await fetch('/lightning-action.php?action=tiktokfree_user_perform_task', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const text = await response.text();
                
                if (text.includes('успешно') || text.includes('зачислено')) {
                    window.tikbotLog(`✅ Выполнено! +${task.reward} монет`);
                    botState.stats.completed++;
                    botState.stats.earned += task.reward;
                    playSound();
                    sendWebhook('/complete', { reward: task.reward, total: botState.stats.earned });
                    return true;
                } else if (text.includes('уже выполнено')) {
                    window.tikbotLog(`⚠️ Уже выполнено ранее`);
                    return true;
                } else {
                    window.tikbotLog(`❌ Ошибка: ${text.substring(0, 50)}`);
                    return false;
                }
            } catch(e) {
                window.tikbotLog(`❌ Ошибка сети: ${e.message}`);
                return false;
            }
        }
        
        function hideTask(task) {
            const formData = new FormData();
            formData.append('UserPerformTask[id]', task.id);
            formData.append('UserPerformTask[task_execution_id]', task.execId);
            formData.append('UserPerformTask[nonce]', task.nonce);
            formData.append('UserPerformTask[submit]', 'hide');
            fetch('/lightning-action.php?action=tiktokfree_user_perform_task', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            task.element?.remove();
            window.tikbotLog(`🗑 Задание скрыто`);
        }
        
        async function doOneTask() {
            return new Promise((resolve) => {
                const task = getCurrentTask();
                if (!task) {
                    window.tikbotLog('❌ Нет заданий');
                    resolve(false);
                    return;
                }
                
                window.tikbotLog(`🎯 Задание: +${task.reward} монет`);
                
                if (!clickExecute()) {
                    resolve(false);
                    return;
                }
                
                let resolved = false;
                let timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        window.tikbotLog('⏰ Таймаут ожидания');
                        resolve(false);
                    }
                }, 60000);
                
                const onReturn = () => {
                    if (!document.hidden && !resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        document.removeEventListener('visibilitychange', onReturn);
                        
                        window.tikbotLog('👀 Возврат на сайт, проверяю...');
                        setTimeout(async () => {
                            const success = await clickCheck(task);
                            if (success) hideTask(task);
                            resolve(success);
                        }, 3000);
                    }
                };
                
                document.addEventListener('visibilitychange', onReturn);
            });
        }
        
        async function startBot() {
            if (botState.isRunning) {
                window.tikbotLog('⚠️ Бот уже запущен');
                return;
            }
            
            botState.isRunning = true;
            botState.stats.startTime = Date.now();
            
            updateUI();
            window.tikbotLog('🚀 Бот запущен');
            sendWebhook('/start');
            
            let count = 0;
            while (botState.isRunning && count < CONFIG.maxTasksPerSession) {
                const success = await doOneTask();
                if (success) count++;
                await new Promise(r => setTimeout(r, 2000));
                
                if (!document.querySelector(CONFIG.selectors.taskWrapper)) {
                    window.tikbotLog('📭 Задания кончились, обновляю...');
                    setTimeout(() => location.reload(), 2000);
                    break;
                }
            }
            
            botState.isRunning = false;
            window.tikbotLog(`🏁 Бот остановлен. Выполнено: ${botState.stats.completed}, Заработано: ${botState.stats.earned.toFixed(2)}`);
            sendWebhook('/stop', { total: botState.stats.earned });
            updateUI();
        }
        
        function stopBot() {
            botState.isRunning = false;
            window.tikbotLog('🛑 Бот остановлен вручную');
            updateUI();
        }
        
        // ========== ЗАПУСК ==========
        setTimeout(() => {
            createUI();
            setupMessageListener();
            if (CONFIG.autoStart) {
                setTimeout(() => startBot(), 3000);
            }
            window.tikbotLog('✅ Бот готов! Нажми СТАРТ');
        }, 2000);
    }
    
})();
