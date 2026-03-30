// ========== ДОБАВЛЯЕМ КНОПКУ НА СТРАНИЦУ TIKTOK ==========
function addCompletionButton() {
    // Удаляем старую кнопку если есть
    const oldBtn = document.getElementById('tikbot-complete-btn');
    if (oldBtn) oldBtn.remove();
    
    // Создаем кнопку
    const btn = document.createElement('div');
    btn.id = 'tikbot-complete-btn';
    btn.innerHTML = `
        <div style="
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 99999;
            background: linear-gradient(135deg, #4caf50, #2e7d32);
            color: white;
            padding: 14px 24px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            font-family: sans-serif;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            animation: pulse 1s infinite;
            border: 2px solid white;
        ">
            <span style="font-size: 20px;">✅</span>
            <span>ГОТОВО! Я ВЫПОЛНИЛ</span>
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        </style>
    `;
    
    btn.onclick = () => {
        console.log('🔘 Кнопка "ГОТОВО" нажата!');
        btn.remove();
        
        // Сохраняем в localStorage что действие выполнено
        localStorage.setItem('tikbot_action_completed', 'true');
        localStorage.setItem('tikbot_completed_time', Date.now());
        
        // Отправляем вебхук в MacroDroid (подтверждение)
        const webhookUrl = SETTINGS.webhookUrl + '/action_completed';
        GM_xmlhttpRequest({
            method: 'POST',
            url: webhookUrl,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                timestamp: Date.now(),
                taskType: taskType,
                action: 'completed_by_user'
            })
        });
        
        // Закрываем вкладку через 1 секунду
        setTimeout(() => {
            console.log('🔚 Закрываю вкладку по нажатию кнопки');
            window.close();
        }, 1000);
    };
    
    document.body.appendChild(btn);
    
    console.log('✅ Кнопка "ГОТОВО" добавлена на страницу TikTok');
    console.log('📌 MacroDroid должен нажать эту кнопку после выполнения действия');
}

// Добавляем кнопку при загрузке страницы
if (isTikTok) {
    setTimeout(addCompletionButton, 2000);
}
