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
    // ============================================================
    const SERVER_URL = 'http://localhost:3000'; 

    btn.disabled = true;
    btn.innerText = "ORQUESTRANDO...";
    resultArea.classList.remove('hidden');
    statusText.innerText = "PROCESSANDO...";
    debateLog.innerHTML = "";

    try {
        const response = await fetch(`${SERVER_URL}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input })
        });

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
        statusText.innerText = "OFFLINE";
        statusText.style.color = "#f00";
    } finally {
        btn.disabled = false;
        btn.innerText = "EXECUTAR AUDITORIA";
    }
});