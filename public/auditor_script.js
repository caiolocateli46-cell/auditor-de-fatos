document.getElementById('verify-btn').addEventListener('click', async () => {
    const input = document.getElementById('info-input').value.trim();
    if (!input) return alert("ENTRADA VAZIA");

    const btn = document.getElementById('verify-btn');
    const resultArea = document.getElementById('result-area');
    const statusText = document.getElementById('status-text');
    const confidenceFill = document.getElementById('confidence-fill');
    const debateLog = document.getElementById('debate-log');
    const cacheStatus = document.getElementById('cache-status');

    // UI Reset
    btn.disabled = true;
    btn.innerText = "ORQUESTRANDO AGENTES...";
    resultArea.classList.remove('hidden');
    statusText.innerText = "INICIANDO...";
    statusText.style.color = "#fff";
    confidenceFill.style.width = "0%";
    debateLog.innerHTML = `<div class="log-entry">> [SISTEMA]: Inicializando orquestrador...</div>`;

    const addLog = (msg) => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerText = `> ${msg}`;
        debateLog.appendChild(entry);
        debateLog.scrollTop = debateLog.scrollHeight;
    };

    try {
        // Simulação de passos iniciais para efeito visual
        setTimeout(() => addLog("Verificando integridade da conexão..."), 300);
        setTimeout(() => addLog("Orquestrador analisando complexidade da entrada..."), 600);

        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input })
        });

        const data = await response.json();

        // Efeito de log em tempo real para os resultados da IA
        if (data.debateLog) {
            for (let i = 0; i < data.debateLog.length; i++) {
                await new Promise(r => setTimeout(r, 400));
                addLog(data.debateLog[i]);
            }
        }

        // Finalização
        statusText.innerText = data.status.replace(/_/g, ' ');
        statusText.style.color = data.color;
        confidenceFill.style.width = data.score + "%";
        confidenceFill.style.backgroundColor = data.color;
        
        if (data.details.includes("[CACHE_HIT]")) {
            cacheStatus.innerText = "CACHE_HIT (PERSISTENT)";
            cacheStatus.style.color = "#00f2ff";
        } else {
            cacheStatus.innerText = "NEW_COMPUTATION";
            cacheStatus.style.color = "#888";
        }

        addLog(`[CONSENSO]: Auditoria finalizada com ${data.score}% de confiança.`);

    } catch (error) {
        addLog(`[ERRO]: Falha na orquestração: ${error.message}`);
        statusText.innerText = "ERRO_SISTEMA";
        statusText.style.color = "#f00";
    } finally {
        btn.disabled = false;
        btn.innerText = "EXECUTAR ORQUESTRADOR";
    }
});