document.getElementById('verify-btn').addEventListener('click', async () => {
  const input = document.getElementById('info-input').value.trim();
  const fileInput = document.getElementById('file-input');
  
  if (!input && (!fileInput.files || fileInput.files.length === 0)) {
    alert('ERRO: DADOS OU ARQUIVOS AUSENTES');
    return;
  }

  const resultArea = document.getElementById('result-area');
  const statusText = document.getElementById('status-text');
  const confidenceFill = document.getElementById('confidence-fill');
  const details = document.getElementById('details');
  const btn = document.getElementById('verify-btn');
  
  // UI State
  btn.disabled = true;
  btn.innerText = 'PROCESSANDO...';
  resultArea.classList.remove('hidden');
  statusText.innerText = 'CONSULTANDO REGISTROS...';
  statusText.style.color = '#1a1a1a';
  confidenceFill.style.width = '0%';
  details.innerText = 'Varrendo bancos de dados e cruzando metadados...';

  try {
    const hasFile = fileInput.files && fileInput.files.length > 0;

    //  AQUI ESTÁ A CORREÇÃO IMPORTANTE
    const response = await fetch(`${window.location.origin}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        hasImage: hasFile
      })
    });

    const data = await response.json();

    if (data.error === "API_KEY_MISSING") {
      statusText.innerText = 'ERRO DE CONFIGURAÇÃO';
      statusText.style.color = '#b00';
      details.innerText = 'O servidor backend está rodando, mas falta a chave GEMINI_API_KEY no ambiente.';
      btn.innerText = 'TENTAR NOVAMENTE';
      btn.disabled = false;
      return;
    }

    // Update UI with real AI results
    statusText.innerText = data.status;
    statusText.style.color = data.color;
    confidenceFill.style.width = data.score + '%';
    confidenceFill.style.backgroundColor = data.color;
    
    // Mostrar o Log de Debate/Consenso
    if (data.debateLog && data.debateLog.length > 0) {
      let logHtml = '<div class="debate-log-container"><div class="log-title">LOG DE CONSENSO (MULT-IA):</div>';
      data.debateLog.forEach(log => {
        logHtml += `<div class="log-entry">> ${log}</div>`;
      });
      logHtml += '</div>';
      details.innerHTML = logHtml + `<p class="final-detail">${data.details}</p>`;
    } else {
      details.innerText = data.details;
    }

  } catch (error) {
    console.error('Erro:', error);
    statusText.innerText = 'SERVIDOR OFFLINE';
    statusText.style.color = '#b00';
    details.innerText = 'Não foi possível conectar ao servidor online.';
  } finally {
    btn.disabled = false;
    btn.innerText = 'NOVA AUDITORIA';
  }
});
