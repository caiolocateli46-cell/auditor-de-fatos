require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { CohereClient } = require('cohere-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // Cache de 1 hora

// Clientes das IAs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- PERSONALIDADES E PESOS ---
const AI_CONFIG = {
    GEMINI: { name: "GOOGLE_GEN_ALPHA", weight: 1.2, role: "DADOS_GERAIS" },
    OPENAI: { name: "OPENAI_LOGIC_GAMMA", weight: 1.5, role: "ANALISE_LOGICA" },
    DEEPSEEK: { name: "DEEPSEEK_SPEED_BETA", weight: 1.0, role: "VELOCIDADE" },
    GROQ: { name: "GROQ_ULTRA_FAST", weight: 1.1, role: "PERFORMANCE" },
    COHERE: { name: "COHERE_CONTEXT_DELTA", weight: 1.3, role: "CONTEXTO_SEMANTICO" }
};

// --- ORQUESTRADOR CENTRAL ---
function orchestrateIA(input) {
    const len = input.length;
    if (len < 30) return ["DEEPSEEK", "GROQ"];
    if (len < 100) return ["GEMINI", "GROQ", "DEEPSEEK"];
    return ["OPENAI", "GEMINI", "COHERE", "DEEPSEEK"];
}

// --- SCRAPER DE LINKS ---
async function scrapeLink(url) {
    try {
        const response = await fetch(url, { timeout: 5000 });
        const body = await response.text();
        const $ = cheerio.load(body);
        $('script, style').remove();
        return $('body').text().substring(0, 3000).replace(/\s+/g, ' ');
    } catch (e) {
        return `Erro ao ler link: ${e.message}`;
    }
}

// --- PROVIDERS DE IA ---

async function callGemini(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analise a veracidade desta informação: "${text}". Responda APENAS em JSON: {"status": "INTEGRIDADE CONFIRMADA" | "DADOS INCONCLUSIVOS" | "POTENCIAL DESINFORMAÇÃO", "score": 0-100, "details": "Explicação técnica curta (200 carac)."}`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
    } catch (e) { return null; }
}

async function callOpenAI(text) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("SUA_CHAVE")) return null;
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Auditor de Fatos técnico." }, { role: "user", content: text }],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
        return JSON.parse(response.data.choices[0].message.content);
    } catch (e) { return null; }
}

async function callDeepSeek(text) {
    if (!process.env.DEEPSEEK_API_KEY) return null;
    try {
        const res = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "user", content: `Analise veracidade (JSON): ${text}` }],
            response_format: { type: 'json_object' }
        }, { headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) { return null; }
}

async function callGroq(text) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Analise veracidade (JSON): ${text}` }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });
        return JSON.parse(chatCompletion.choices[0].message.content);
    } catch (e) { return null; }
}

async function callCohere(text) {
    try {
        const response = await cohere.chat({
            message: `Analise veracidade e responda apenas com um JSON estruturado: ${text}`,
            model: "command-r-plus"
        });
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) { return null; }
}

// --- FILTRO GATEKEEPER ---
function gatekeeper(text) {
    if (text.length < 5) return "DADOS_INSUFICIENTES";
    const trivial = ["oi", "ola", "teste", "quem e voce", "bom dia"];
    if (trivial.some(t => text.toLowerCase().includes(t))) return "TRIVIAL_DETECTION";
    return null;
}

// --- LOGICA PRINCIPAL DE CONSENSO ---
app.post('/api/verify', async (req, res) => {
    let { text } = req.body;
    
    // 1. Check Cache
    const cached = cache.get(text);
    if (cached) return res.json({ ...cached, details: `[CACHE_HIT] ${cached.details}` });

    // 2. Gatekeeper
    const blockReason = gatekeeper(text);
    if (blockReason) return res.json({ status: "SISTEMA_EM_ESPERA", score: 0, details: `GATEKEEPER: ${blockReason}. Protocolo de economia ativado.`, color: "#555" });

    // 3. Link Detection
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    let scrapedContent = "";
    if (urlMatch) {
        console.log("Link detectado, raspando...");
        scrapedContent = await scrapeLink(urlMatch[0]);
        text = `URL: ${urlMatch[0]} | CONTEÚDO: ${scrapedContent} | QUERY: ${text}`;
    }

    // 4. Orchestration & Parallelism
    const selectedIAs = orchestrateIA(text);
    console.log(`Orquestrador selecionou: ${selectedIAs}`);

    const tasks = selectedIAs.map(id => {
        if (id === "GEMINI") return callGemini(text).then(d => ({ id, data: d }));
        if (id === "OPENAI") return callOpenAI(text).then(d => ({ id, data: d }));
        if (id === "DEEPSEEK") return callDeepSeek(text).then(d => ({ id, data: d }));
        if (id === "GROQ") return callGroq(text).then(d => ({ id, data: d }));
        if (id === "COHERE") return callCohere(text).then(d => ({ id, data: d }));
    });

    const rawResults = await Promise.all(tasks);
    const validResults = rawResults.filter(r => r.data !== null);

    // 5. Consensus Calculation (Weighted)
    if (validResults.length === 0) {
        return res.json({ status: "FALHA_CONEXAO", score: 0, details: "Todas as inteligências estão offline ou sem cota.", color: "#000" });
    }

    let weightedScoreTotal = 0;
    let weightSum = 0;
    let debateLog = [];

    validResults.forEach(r => {
        const config = AI_CONFIG[r.id];
        weightedScoreTotal += (r.data.score * config.weight);
        weightSum += config.weight;
        debateLog.push(`[${config.name}] (${config.role}): Analisado com peso ${config.weight}. Score: ${r.data.score}%`);
    });

    const finalScore = Math.round(weightedScoreTotal / weightSum);
    
    let finalStatus = "DADOS_INCONCLUSIVOS";
    let finalColor = "#850";
    if (finalScore > 75) { finalStatus = "INTEGRIDADE_CONFIRMADA"; finalColor = "#060"; }
    else if (finalScore < 40) { finalStatus = "POTENCIAL_DESINFORMAÇÃO"; finalColor = "#b00"; }

    const finalResult = {
        status: finalStatus,
        score: finalScore,
        details: `ORQUESTRADOR_CENTRAL: Consenso atingido via ${validResults.length} agentes independentes.`,
        color: finalColor,
        debateLog: debateLog
    };

    // 6. Save Cache
    cache.set(req.body.text, finalResult);
    res.json(finalResult);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auditor.html')));

app.listen(PORT, () => console.log(`ORQUESTRADOR CENTRAL ATIVO EM http://localhost:${PORT}`));