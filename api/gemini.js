const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent';
const FALLBACK_DISTRACTORS = ['공원', '병원', '책상', '자동차', '가족', '식사', '음식', '산책', '저녁', '아침'];

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method !== 'POST') {
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
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

    const count = clampNumber(body.count, 1, 10, 5);
    const level = typeof body.level === 'string' ? body.level : 'beginner';

    const prompt = buildPrompt(count, level);

    try {
        const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 512
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error response', errorText);
            return res.status(502).json({ error: 'Gemini API 호출에 실패했습니다.' });
        }

        const payload = await response.json();
        const text = extractTextFromGemini(payload);
        if (!text) {
            throw new Error('Gemini 응답에서 텍스트를 찾을 수 없습니다.');
        }

        const parsed = parseQuizText(text);
        if (!parsed.length) {
            throw new Error('응답에서 퀴즈 데이터를 구성하지 못했습니다.');
        }

        const normalized = parsed
            .map(item => normalizeItem(item))
            .filter(Boolean)
            .slice(0, count);

        if (!normalized.length) {
            throw new Error('정상적인 항목이 생성되지 않았습니다.');
        }

        return res.status(200).json({ items: normalized });
    } catch (error) {
        console.error('Gemini proxy error', error);
        return res.status(500).json({ error: '퀴즈 데이터를 가져오지 못했습니다.' });
    }
};

function buildPrompt(count, level) {
    return [
        '당신은 일본어 교사입니다.',
        `학습 수준은 ${level}이며, 일본어 단어 객관식 문제 ${count}개를 생성하세요.`,
        '각 문제는 다음 JSON 배열 형태로만 출력합니다.',
        '[',
        '{',
        '  "word": "일본어 단어 (한자 또는 가타카나)",',
        '  "reading": "후리가나",',
        '  "meaning": "한국어 뜻",',
        '  "choices": ["보기1", "보기2", "보기3", "보기4"],',
        '  "correctIndex": 0,',
        '  "explanation": "간단한 설명 (선택 사항)"',
        '}',
        ']',
        '규칙:',
        '- choices에는 meaning을 포함한 4개의 한국어 의미를 제공합니다.',
        '- correctIndex는 meaning이 위치한 인덱스를 정확히 나타냅니다.',
        '- 오직 JSON 배열만 출력하고 다른 텍스트는 포함하지 마세요.'
    ].join('\n');
}

function extractTextFromGemini(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
        return '';
    }
    return parts.map(part => part.text || '').join('').trim();
}

function parseQuizText(text) {
    const cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    try {
        const json = JSON.parse(cleaned);
        if (Array.isArray(json)) {
            return json;
        }
        if (Array.isArray(json.items)) {
            return json.items;
        }
        return [];
    } catch (error) {
        console.warn('Failed to parse Gemini JSON', error, text);
        return [];
    }
}

function normalizeItem(raw) {
    if (!raw) return null;
    const word = toText(raw.word || raw.term);
    const reading = toText(raw.reading || raw.furigana || raw.kana);
    const meaning = toText(raw.meaning || raw.translation || raw.correct);
    let choices = Array.isArray(raw.choices) ? raw.choices.map(toText).filter(Boolean) : [];
    const explanation = toText(raw.explanation);

    if (!word || !meaning) {
        return null;
    }

    if (!choices.length) {
        const distractors = Array.isArray(raw.distractors) ? raw.distractors.map(toText).filter(Boolean) : [];
        choices = [meaning, ...distractors];
    }

    const optionObjects = Array.from(new Set(choices.filter(Boolean)))
        .map(choice => ({ text: choice, isCorrect: choice === meaning }));

    if (!optionObjects.some(option => option.isCorrect)) {
        optionObjects.unshift({ text: meaning, isCorrect: true });
    }

    const trimmed = optionObjects.slice(0, 4);
    for (const fallback of FALLBACK_DISTRACTORS) {
        if (trimmed.length >= 4) {
            break;
        }
        if (!trimmed.some(option => option.text === fallback)) {
            trimmed.push({ text: fallback, isCorrect: false });
        }
    }

    while (trimmed.length < 4) {
        trimmed.push({ text: '알 수 없음', isCorrect: false });
    }

    const shuffled = shuffle(trimmed);
    let correctIndex = shuffled.findIndex(option => option.isCorrect);

    if (typeof raw.correctIndex === 'number' && raw.correctIndex >= 0 && raw.correctIndex < trimmed.length) {
        const original = trimmed[raw.correctIndex];
        if (original) {
            const overrideIndex = shuffled.findIndex(option => option.text === original.text);
            if (overrideIndex >= 0) {
                correctIndex = overrideIndex;
            }
        }
    }

    if (correctIndex < 0) {
        correctIndex = shuffled.findIndex(option => option.text === meaning);
    }

    if (correctIndex < 0) {
        shuffled[0] = { text: meaning, isCorrect: true };
        correctIndex = 0;
    }

    return {
        word,
        reading,
        meaning,
        choices: shuffled.map(option => option.text),
        correctIndex,
        explanation
    };
}

function shuffle(array) {
    const cloned = array.slice();
    for (let i = cloned.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
}

function toText(value) {
    return value ? String(value).trim() : '';
}

function clampNumber(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
        return Math.max(min, Math.min(max, parsed));
    }
    return fallback;
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
