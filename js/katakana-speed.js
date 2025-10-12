(function() {
    const KATAKANA_DATA = [
        { char: 'ア', romaji: 'a', korean: '아' },
        { char: 'イ', romaji: 'i', korean: '이' },
        { char: 'ウ', romaji: 'u', korean: '우' },
        { char: 'エ', romaji: 'e', korean: '에' },
        { char: 'オ', romaji: 'o', korean: '오' },
        { char: 'カ', romaji: 'ka', korean: '카' },
        { char: 'キ', romaji: 'ki', korean: '키' },
        { char: 'ク', romaji: 'ku', korean: '쿠' },
        { char: 'ケ', romaji: 'ke', korean: '케' },
        { char: 'コ', romaji: 'ko', korean: '코' },
        { char: 'サ', romaji: 'sa', korean: '사' },
        { char: 'シ', romaji: 'shi', korean: '시' },
        { char: 'ス', romaji: 'su', korean: '스' },
        { char: 'セ', romaji: 'se', korean: '세' },
        { char: 'ソ', romaji: 'so', korean: '소' },
        { char: 'タ', romaji: 'ta', korean: '타' },
        { char: 'チ', romaji: 'chi', korean: '치' },
        { char: 'ツ', romaji: 'tsu', korean: '츠' },
        { char: 'テ', romaji: 'te', korean: '테' },
        { char: 'ト', romaji: 'to', korean: '토' },
        { char: 'ナ', romaji: 'na', korean: '나' },
        { char: 'ニ', romaji: 'ni', korean: '니' },
        { char: 'ヌ', romaji: 'nu', korean: '누' },
        { char: 'ネ', romaji: 'ne', korean: '네' },
        { char: 'ノ', romaji: 'no', korean: '노' },
        { char: 'ハ', romaji: 'ha', korean: '하' },
        { char: 'ヒ', romaji: 'hi', korean: '히' },
        { char: 'フ', romaji: 'fu', korean: '후' },
        { char: 'ヘ', romaji: 'he', korean: '헤' },
        { char: 'ホ', romaji: 'ho', korean: '호' },
        { char: 'マ', romaji: 'ma', korean: '마' },
        { char: 'ミ', romaji: 'mi', korean: '미' },
        { char: 'ム', romaji: 'mu', korean: '무' },
        { char: 'メ', romaji: 'me', korean: '메' },
        { char: 'モ', romaji: 'mo', korean: '모' },
        { char: 'ヤ', romaji: 'ya', korean: '야' },
        { char: 'ユ', romaji: 'yu', korean: '유' },
        { char: 'ヨ', romaji: 'yo', korean: '요' },
        { char: 'ラ', romaji: 'ra', korean: '라' },
        { char: 'リ', romaji: 'ri', korean: '리' },
        { char: 'ル', romaji: 'ru', korean: '루' },
        { char: 'レ', romaji: 're', korean: '레' },
        { char: 'ロ', romaji: 'ro', korean: '로' },
        { char: 'ワ', romaji: 'wa', korean: '와' },
        { char: 'ヲ', romaji: 'wo', korean: '오' },
        { char: 'ン', romaji: 'n', korean: '응' }
    ];

    const settings = {
        minTimeSeconds: 3,
        maxRandomSeconds: 10
    };

    const state = {
        isRunning: false,
        rounds: 10,
        completedRounds: 0,
        score: 0,
        timeLimitMs: 5000,
        randomizeTime: false,
        currentQuestion: null,
        optionButtons: [],
        timerIntervalId: null,
        pendingTimeoutId: null,
        deck: [],
        allowInput: true
    };

    const elements = {};

    document.addEventListener('DOMContentLoaded', () => {
        if (!isKatakanaPage()) return;
        cacheElements();
        attachEventListeners();
        resetUI();
    });

    function isKatakanaPage() {
        const file = window.location.pathname.split('/').pop();
        return file === 'katakana-speed.html';
    }

    function cacheElements() {
        elements.roundInput = document.getElementById('round-count');
        elements.timeLimit = document.getElementById('time-limit');
        elements.timeLimitValue = document.getElementById('time-limit-value');
        elements.randomizeTime = document.getElementById('randomize-time');
        elements.startBtn = document.getElementById('start-game');
        elements.gameCard = document.getElementById('game-card');
        elements.resultsCard = document.getElementById('results-card');
        elements.restartBtn = document.getElementById('restart');
        elements.roundIndicator = document.getElementById('round-indicator');
        elements.score = document.getElementById('score');
        elements.timerFill = document.getElementById('timer-fill');
        elements.timerValue = document.getElementById('timer-value');
        elements.katakanaChar = document.getElementById('katakana-char');
        elements.options = document.getElementById('options');
        elements.feedback = document.getElementById('feedback');
        elements.resultsSummary = document.getElementById('results-summary');
    }

    function attachEventListeners() {
        elements.timeLimit.addEventListener('input', () => {
            updateTimeLimitDisplay(elements.timeLimit.value);
        });

        elements.startBtn.addEventListener('click', () => {
            if (!state.isRunning) {
                startGame();
            }
        });

        elements.restartBtn.addEventListener('click', () => {
            resetUI();
            startGame();
        });

        document.addEventListener('keydown', handleKeyInput);
    }

    function resetUI() {
        stopTimer();
        clearPendingTimeout();
        state.isRunning = false;
        state.completedRounds = 0;
        state.score = 0;
        state.currentQuestion = null;
        state.allowInput = true;
        elements.gameCard.classList.add('hidden');
        elements.resultsCard.classList.add('hidden');
        elements.feedback.textContent = '';
        elements.feedback.classList.remove('success', 'error');
        elements.options.innerHTML = '';
        elements.roundIndicator.textContent = '0 / 0';
        elements.score.textContent = '0';
        updateTimeLimitDisplay(elements.timeLimit.value);
        setSettingsDisabled(false);
    }

    function startGame() {
        const rounds = clamp(parseInt(elements.roundInput.value, 10) || 10, 5, 30);
        elements.roundInput.value = rounds;

        const baseTimeSeconds = parseFloat(elements.timeLimit.value) || 5;
        const clampedBase = clamp(baseTimeSeconds, settings.minTimeSeconds, settings.maxRandomSeconds);
        elements.timeLimit.value = clampedBase;
        updateTimeLimitDisplay(clampedBase);

        state.rounds = rounds;
        state.score = 0;
        state.completedRounds = 0;
        state.randomizeTime = Boolean(elements.randomizeTime.checked);
        state.deck = buildDeck();
        state.isRunning = true;
        state.allowInput = true;

        elements.score.textContent = '0';
        elements.feedback.textContent = '';
        elements.feedback.classList.remove('success', 'error');
        elements.resultsCard.classList.add('hidden');
        elements.gameCard.classList.remove('hidden');
        setSettingsDisabled(true);

        nextQuestion();
    }

    function buildDeck() {
        const shuffled = shuffleArray([...KATAKANA_DATA]);
        return shuffled;
    }

    function nextQuestion() {
        if (!state.isRunning) return;

        if (state.completedRounds >= state.rounds) {
            return finishGame();
        }

        if (state.deck.length === 0) {
            state.deck = buildDeck();
        }

        state.currentQuestion = state.deck.pop();
        state.completedRounds += 1;
        state.allowInput = true;

        const currentTimeSeconds = getQuestionTimeSeconds();
        state.timeLimitMs = currentTimeSeconds * 1000;

        elements.roundIndicator.textContent = `${state.completedRounds} / ${state.rounds}`;
        elements.katakanaChar.textContent = state.currentQuestion.char;
        elements.feedback.textContent = '';
        elements.feedback.classList.remove('success', 'error');

        renderOptions(state.currentQuestion);
        startTimer(state.timeLimitMs);
    }

    function getQuestionTimeSeconds() {
        if (!state.randomizeTime) {
            return parseFloat(elements.timeLimit.value);
        }
        const min = settings.minTimeSeconds;
        const max = parseFloat(elements.timeLimit.value);
        return roundToHalf(randomBetween(min, Math.max(min, max)));
    }

    function renderOptions(question) {
        elements.options.innerHTML = '';
        const correct = question;
        const candidates = shuffleArray(KATAKANA_DATA.filter(item => item !== correct)).slice(0, 4);
        const options = shuffleArray([correct, ...candidates]);
        const fragment = document.createDocumentFragment();

        state.optionButtons = options.map((item, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-btn';
            btn.dataset.romaji = item.romaji;
            btn.disabled = false;
            btn.textContent = formatOptionLabel(item);
            btn.addEventListener('click', () => handleAnswer(btn));
            fragment.appendChild(btn);
            return btn;
        });

        elements.options.appendChild(fragment);
    }

    function handleAnswer(button) {
        if (!state.isRunning || !state.allowInput || !state.currentQuestion) return;
        state.allowInput = false;

        stopTimer();
        const selectedRomaji = button.dataset.romaji;
        const isCorrect = selectedRomaji === state.currentQuestion.romaji;

        revealOptions(selectedRomaji);
        updateFeedback(isCorrect);

        if (isCorrect) {
            state.score += 1;
            elements.score.textContent = String(state.score);
        }

        scheduleNextQuestion();
    }

    function revealOptions(selectedRomaji) {
        state.optionButtons.forEach(btn => {
            const isOptionCorrect = btn.dataset.romaji === state.currentQuestion.romaji;
            btn.classList.toggle('correct', isOptionCorrect);
            if (!isOptionCorrect && btn.dataset.romaji === selectedRomaji) {
                btn.classList.add('incorrect');
            }
            btn.disabled = true;
        });
    }

    function updateFeedback(isCorrect) {
        const message = isCorrect ? '정답입니다! 잘했어요 👍' : `오답이에요. 정답은 ${formatOptionLabel(state.currentQuestion)} 입니다.`;
        elements.feedback.textContent = message;
        elements.feedback.classList.toggle('success', isCorrect);
        elements.feedback.classList.toggle('error', !isCorrect);
    }

    function scheduleNextQuestion() {
        clearPendingTimeout();
        state.pendingTimeoutId = window.setTimeout(() => {
            state.pendingTimeoutId = null;
            nextQuestion();
        }, 1200);
    }

    function startTimer(limitMs) {
        stopTimer();
        const start = performance.now();
        const end = start + limitMs;

        updateTimerUI(limitMs, limitMs);

        state.timerIntervalId = window.setInterval(() => {
            const now = performance.now();
            const remaining = Math.max(0, end - now);
            updateTimerUI(remaining, limitMs);
            if (remaining <= 0) {
                stopTimer();
                handleTimeUp();
            }
        }, 100);
    }

    function updateTimerUI(remainingMs, totalMs) {
        if (!totalMs) totalMs = state.timeLimitMs;
        const percentage = Math.max(0, Math.min(remainingMs / totalMs, 1));
        elements.timerFill.style.width = `${(percentage * 100).toFixed(1)}%`;
        elements.timerValue.textContent = `${(remainingMs / 1000).toFixed(1)}초`;
    }

    function stopTimer() {
        if (state.timerIntervalId !== null) {
            window.clearInterval(state.timerIntervalId);
            state.timerIntervalId = null;
        }
    }

    function handleTimeUp() {
        if (!state.isRunning || !state.allowInput) return;
        state.allowInput = false;
        revealOptions(null);
        elements.feedback.textContent = `시간 초과! 정답은 ${formatOptionLabel(state.currentQuestion)} 입니다.`;
        elements.feedback.classList.remove('success');
        elements.feedback.classList.add('error');
        scheduleNextQuestion();
    }

    function clearPendingTimeout() {
        if (state.pendingTimeoutId !== null) {
            window.clearTimeout(state.pendingTimeoutId);
            state.pendingTimeoutId = null;
        }
    }

    function finishGame() {
        state.isRunning = false;
        stopTimer();
        clearPendingTimeout();
        elements.gameCard.classList.add('hidden');
        elements.resultsCard.classList.remove('hidden');
        const accuracy = state.rounds > 0 ? Math.round((state.score / state.rounds) * 100) : 0;
        elements.resultsSummary.textContent = `총 ${state.rounds}문제 중 ${state.score}문제를 맞혔어요! 정답률 ${accuracy}%`;
        setSettingsDisabled(false);
    }

    function handleKeyInput(event) {
        if (!state.isRunning || !state.allowInput) return;
        const key = event.key;
        if (!/^[1-5]$/.test(key)) return;
        const index = Number(key) - 1;
        const button = state.optionButtons[index];
        if (button) {
            button.focus();
            button.click();
        }
    }

    function updateTimeLimitDisplay(value) {
        elements.timeLimitValue.textContent = `${Number(value).toFixed(1)}초`;
    }

    function formatOptionLabel(item) {
        return `${item.korean} (${item.romaji})`;
    }

    function setSettingsDisabled(disabled) {
        elements.roundInput.disabled = disabled;
        elements.timeLimit.disabled = disabled;
        elements.randomizeTime.disabled = disabled;
        elements.startBtn.disabled = disabled;
        elements.startBtn.textContent = disabled ? '게임 진행 중...' : '게임 시작하기';
    }

    function shuffleArray(arr) {
        const clone = [...arr];
        for (let i = clone.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [clone[i], clone[j]] = [clone[j], clone[i]];
        }
        return clone;
    }

    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function roundToHalf(value) {
        return Math.round(value * 2) / 2;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
})();
