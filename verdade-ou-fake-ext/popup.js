document.getElementById('verify-btn').addEventListener('click', async () => {
    const input = document.getElementById('info-input').value.trim();
    if (!input) return alert("ENTRADA VAZIA");

    const btn = document.getElementById('verify-btn');
    const resultArea = document.getElementById('result-area');
    const statusText = document.getElementById('status-text');
    const confidenceFill = document.getElementById('confidence-fill');
    const debateLog = document.getElementById('debate-log');

    // ============================================================
    // CONFIGURAÇÃO DE PUBLICAÇÃO:
    // Troque 'http://localhost:3000' pelo seu link do Render
    // Exemplo: const SERVER_URL = 'https://auditor-de-fatos.onrender.com';
    // ============================================================
    const SERVER_URL = 'https://auditor-de-fatos.onrender.com'; 

    btn.disabled = true;
    btn.innerText = "ORQUESTRANDO...";
    resultArea.classList.remove('hidden');
    statusText.innerText = "PROCESSANDO...";
    debateLog.innerHTML = "";

    try {
        // Primeiro, testa se o servidor está vivo
        const healthCheck = await fetch(`${SERVER_URL}/api/health`).catch(() => null);
        if (!healthCheck) {
            throw new Error("SERVER_UNREACHABLE");
        }

        const response = await fetch(`${SERVER_URL}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input })
        });

        if (!response.ok) {
            throw new Error(`HTTP_ERROR_${response.status}`);
        }

        const data = await response.json();

        statusText.innerText = data.status.replace(/_/g, ' ');
        statusText.style.color = data.color;
        confidenceFill.style.width = data.score + "%";
        confidenceFill.style.backgroundColor = data.color;

        if (data.debateLog) {
            data.debateLog.forEach(log => {
                const entry = document.createElement('div');
                entry.innerText = `> ${log}`;
                debateLog.appendChild(entry);
            });
        }

    } catch (error) {
        console.error('Erro de Conexão:', error);
        if (error.message === "SERVER_UNREACHABLE") {
            statusText.innerText = "SERVIDOR_DORMINDO";
            statusText.style.color = "#ffaa00";
            alert("O servidor gratuito do Render dorme após inatividade. O site está acordando, tente novamente em 30 segundos.");
        } else {
            statusText.innerText = "ERRO_CONEXAO";
            statusText.style.color = "#f00";
            alert(`Erro: ${error.message}. Verifique se o link no popup.js está correto.`);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "EXECUTAR AUDITORIA";
    }
});