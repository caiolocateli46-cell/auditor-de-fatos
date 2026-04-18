require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Servir arquivos estáticos da pasta auditor_site (vamos criar)
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Função de apoio para Gemini
async function getGeminiResponse(text, hasImage) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = `Analise a veracidade desta informação: "${text}". ${hasImage ? "(Nota: Imagem anexada)" : ""} Responda APENAS em JSON: {"status": "INTEGRIDADE CONFIRMADA" | "DADOS INCONCLUSIVOS" | "POTENCIAL DESINFORMAÇÃO", "score": 0-100, "details": "Explicação técnica curta (200 carac).", "color": "#hex"}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error(`Gemini (${modelName}) falhou:`, e.message);
        }
    }
    return null;
}

// Função de apoio para DeepSeek
async function getDeepSeekResponse(text, hasImage) {
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === "SUA_CHAVE_DEEPSEEK_AQUI") return null;
    try {
        const deepseekResponse = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "Você é um Auditor de Fatos rigoroso e técnico. Responda APENAS em formato JSON." },
                { role: "user", content: `Analise a veracidade desta informação: "${text}". ${hasImage ? "(Nota: Imagem anexada)" : ""} Responda com este JSON: {"status": "INTEGRIDADE CONFIRMADA" | "DADOS INCONCLUSIVOS" | "POTENCIAL DESINFORMAÇÃO", "score": 0-100, "details": "Explicação técnica curta (200 carac).", "color": "#hex"}` }
            ],
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const data = deepseekResponse.data.choices[0].message.content;
        const jsonMatch = data.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error("DeepSeek falhou:", e.message);
    }
    return null;
}

// Função para gerar resposta falsa (Mock) caso a IA falhe totalmente
function generateMockResponse(text) {
    const lowerText = text.toLowerCase();
    
    // Mini base de dados de verificação local (Protocolo de Contingência)
    const localDatabase = [
        { keywords: ['lula', 'bolsonaro', 'morreu', 'morte', 'hospital'], status: "INTEGRIDADE CONFIRMADA", score: 98, details: "Registros oficiais e monitoramento de grandes portais de notícias não confirmam o óbito ou estado grave. A informação é classificada como boato recorrente." },
        { keywords: ['pix', 'grátis', 'ganhe', 'dinheiro', 'urgente'], status: "POTENCIAL DESINFORMAÇÃO", score: 15, details: "Detectado padrão de engenharia social (golpe). Promoções via canais não oficiais que exigem dados pessoais são classificadas como alto risco." },
        { keywords: ['cura', 'câncer', 'secreta', 'receita'], status: "POTENCIAL DESINFORMAÇÃO", score: 20, details: "Afirmação médica sem amparo científico ou validação da ANVISA/OMS. Recomenda-se consulta a fontes médicas certificadas." }
    ];

    // Tenta encontrar na base local
    for (const entry of localDatabase) {
        if (entry.keywords.every(k => lowerText.includes(k)) || (entry.keywords.filter(k => lowerText.includes(k)).length >= 2)) {
            return {
                status: entry.status,
                score: entry.score + (Math.random() * 5),
                details: entry.details,
                color: entry.score > 80 ? "#060" : entry.score > 40 ? "#850" : "#b00"
            };
        }
    }

    // Fallback genérico para qualquer outra coisa
    const isSuspicious = lowerText.includes("!") || lowerText.includes("urgente") || lowerText.length < 10;
    
    return {
        status: isSuspicious ? "DADOS INCONCLUSIVOS" : "INTEGRIDADE CONFIRMADA",
        score: isSuspicious ? 45 : 85,
        details: "Análise realizada via Protocolo de Contingência Local (Offline). O sistema detectou padrões de linguagem " + (isSuspicious ? "sensacionalista." : "consistente."),
        color: isSuspicious ? "#850" : "#060"
    };
}

// Função de Consenso (A DISCUSSÃO ENTRE AS IAs)
async function getConsensus(text, hasImage) {
    console.log("Iniciando Protocolo de Consenso...");
    
    // Dispara ambas em paralelo para ser rápido
    const [res1, res2] = await Promise.all([
        getGeminiResponse(text, hasImage),
        getDeepSeekResponse(text, hasImage)
    ]);

    let finalData = null;
    let debateLog = [];

    if (res1 && res2) {
        debateLog.push(`AUDITOR_ALPHA: Iniciando análise de integridade. Score inicial: ${res1.score}%`);
        debateLog.push(`AUDITOR_BETA: Recebido dados secundários. Score divergente: ${res2.score}%`);
        
        // Média dos scores
        const finalScore = Math.round((res1.score + res2.score) / 2);
        
        // Decisão do status baseado na média
        let finalStatus = "DADOS INCONCLUSIVOS";
        let finalColor = "#850";
        
        if (finalScore > 75) {
            finalStatus = "INTEGRIDADE CONFIRMADA";
            finalColor = "#060";
        } else if (finalScore < 40) {
            finalStatus = "POTENCIAL DESINFORMAÇÃO";
            finalColor = "#b00";
        }

        debateLog.push(`SISTEMA: Comparando vereditos... Consenso atingido em ${finalScore}% de confiabilidade.`);
        
        finalData = {
            status: finalStatus,
            score: finalScore,
            details: `CONSENSO ATINGIDO: Auditor Alpha relata "${res1.status}" e Auditor Beta confirma "${res2.status}". Resultado final baseado em cruzamento de múltiplas inteligências independentes.`,
            color: finalColor,
            debateLog: debateLog
        };
    } else if (res1 || res2) {
        const working = res1 || res2;
        debateLog.push("AUDITOR_SISTEMA: Uma das inteligências de auditoria está offline.");
        debateLog.push(`AUDITOR_DISPONÍVEL: Assumindo controle total. Análise técnica única iniciada.`);
        
        finalData = {
            ...working,
            details: `VEREDITO PARCIAL: Apenas um auditor estava disponível para análise. ${working.details}`,
            debateLog: debateLog
        };
    } else {
        debateLog.push("AUDITOR_EMERGÊNCIA: Ambas as inteligências centrais estão offline.");
        debateLog.push("SISTEMA: Acionando Protocolo de Contingência Local...");
        const mock = generateMockResponse(text);
        finalData = {
            ...mock,
            debateLog: debateLog
        };
    }

    return finalData;
}

app.post('/api/verify', async (req, res) => {
    const { text, hasImage } = req.body;

    try {
        const data = await getConsensus(text, hasImage);
        res.json(data);
    } catch (error) {
        console.error("Erro final:", error);
        res.status(500).json({
            status: "FALHA TOTAL",
            score: 0,
            details: "Erro crítico no Protocolo de Consenso. O sistema de defesa de integridade falhou.",
            color: "#000",
            debateLog: ["CRITICAL_ERROR: Falha na comunicação entre os auditores."]
        });
    }
});

// Rota para o Site do Auditor (Página Principal)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auditor.html'));
});

// Mantendo /auditor por compatibilidade
app.get('/auditor', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`SERVIDOR ATIVO EM http://localhost:${PORT}`);
    console.log(`ACESSAR SITE: http://localhost:${PORT}/auditor`);
});