const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
    'gemini-pro'
];
const KEYWORD_COUNT = 5;

const MOOD_STYLES = {
    warm: {
        label: '따뜻한 분위기',
        guideline: '따뜻하고 포근한 톤으로 희망과 위로를 주는 장면을 구성하세요.'
    },
    moral: {
        label: '교훈적인 분위기',
        guideline: '교훈과 깨달음을 자연스럽게 전달하고, 마지막에 명확한 메시지를 남기세요.'
    },
    humorous: {
        label: '유머러스한 분위기',
        guideline: '익살스럽고 위트 있는 표현을 사용하되, 이야기의 흐름이 매끄럽도록 유지하세요.'
    }
};

module.exports = async function handler(req, res) {
    // CORS 헤더를 먼저 설정
    setCorsHeaders(req, res);

    // OPTIONS 요청 (preflight) 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (error) {
        return res.status(400).json({ error: 'Invalid JSON payload.' });
    }

    const keywords = sanitizeKeywords(body.keywords);
    if (keywords.length < KEYWORD_COUNT) {
        return res.status(400).json({ error: '키워드 5개를 모두 입력해주세요.' });
    }
    const limitedKeywords = keywords.slice(0, KEYWORD_COUNT);

    const moodKey = typeof body.mood === 'string' ? body.mood.toLowerCase() : '';
    const mood = MOOD_STYLES[moodKey];
    if (!mood) {
        return res.status(400).json({ error: '유효한 분위기를 선택해주세요.' });
    }

    const prompt = buildPrompt(limitedKeywords, mood);
    const requestBody = JSON.stringify({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 1100,
            topP: 0.85
        }
    });

    try {
        const { payload, model } = await callGeminiWithFallback(apiKey, requestBody);
        const story = extractTextFromGemini(payload);
        if (!story) {
            throw Object.assign(new Error('Gemini 응답에서 동화 텍스트를 찾을 수 없습니다.'), { status: 502 });
        }

        const trimmedStory = story.trim();
        return res.status(200).json({
            story: trimmedStory,
            keywords: limitedKeywords,
            mood: mood.label,
            model
        });
    } catch (error) {
        console.error('Gemini fairytale proxy error', error);
        const status = error?.status && error.status >= 400 ? error.status : 500;
        const details = error?.message || '알 수 없는 오류가 발생했습니다.';
        return res.status(status).json({ error: '동화 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', details });
    }
};

function buildPrompt(keywords, mood) {
    const keywordList = keywords.map((keyword, index) => `${index + 1}. ${keyword}`).join('\n');
    return [
        '당신은 한국어로 매력적인 아동용 동화를 쓰는 작가입니다.',
        `${mood.guideline}`,
        '주요 조건을 지켜주세요:',
        '- 반드시 아래 키워드를 모두 포함시키되, 자연스럽게 서사 속에 녹여냅니다.',
        '- 이야기 길이는 공백 제외 약 1000자 내외가 되도록 하며, 최소 900자 이상 작성합니다.',
        '- 서론-전개-결말 구조를 갖추고 인물의 감정과 배경을 구체적으로 묘사합니다.',
        '- 문단을 3~4개로 나누고 각 문단은 줄바꿈으로 구분합니다.',
        '- 마지막 문단에서 어린 독자에게 여운이 남는 마무리 문장을 제공합니다.',
        '',
        '키워드 목록:',
        keywordList,
        '',
        '위 조건을 모두 충족하는 한국어 동화를 작성하세요.'
    ].join('\n');
}

function sanitizeKeywords(input) {
    if (!Array.isArray(input)) {
        return [];
    }
    return input
        .map(keyword => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter(Boolean);
}

function extractTextFromGemini(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
        return '';
    }
    return parts.map(part => part.text || '').join('').trim();
}

function setCorsHeaders(req, res) {
    // 허용할 origin 명시적으로 지정
    const allowedOrigins = [
        'https://earthdreamer22.github.io',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:5500'
    ];
    
    const origin = req.headers?.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Origin 헤더가 없는 경우 (직접 브라우저에서 호출)
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간 preflight 캐시
}

async function callGeminiWithFallback(apiKey, body) {
    const headers = { 'Content-Type': 'application/json' };
    let lastError = null;

    for (const model of GEMINI_MODELS) {
        const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body
            });

            if (response.ok) {
                const payload = await response.json();
                return { payload, model };
            }

            const errorText = await response.text();
            console.warn(`Gemini model ${model} returned ${response.status}`, errorText);
            if (shouldRetryModel(response.status, errorText)) {
                lastError = new Error(errorText || `Gemini API error (${response.status})`);
                lastError.status = response.status;
                continue;
            }

            const error = new Error(errorText || `Gemini API error (${response.status})`);
            error.status = response.status;
            throw error;
        } catch (error) {
            if (error?.status && shouldRetryModel(error.status, error.message)) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }

    if (!lastError) {
        lastError = new Error('사용 가능한 Gemini 모델에 접근할 수 없습니다.');
        lastError.status = 502;
    }

    throw lastError;
}

function shouldRetryModel(status, errorText = '') {
    const retriableStatus = status === 403 || status === 404;
    const lower = String(errorText || '').toLowerCase();
    const retriableText = lower.includes('not found') || lower.includes('does not have access') || lower.includes('not supported');
    return retriableStatus || retriableText;
}
