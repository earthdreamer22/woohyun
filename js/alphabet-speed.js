(function() {
    const LETTER_INFO = [
        { upper: 'A', lower: 'a', nameKo: '에이' },
        { upper: 'B', lower: 'b', nameKo: '비' },
        { upper: 'C', lower: 'c', nameKo: '씨' },
        { upper: 'D', lower: 'd', nameKo: '디' },
        { upper: 'E', lower: 'e', nameKo: '이' },
        { upper: 'F', lower: 'f', nameKo: '에프' },
        { upper: 'G', lower: 'g', nameKo: '지' },
        { upper: 'H', lower: 'h', nameKo: '에이치' },
        { upper: 'I', lower: 'i', nameKo: '아이' },
        { upper: 'J', lower: 'j', nameKo: '제이' },
        { upper: 'K', lower: 'k', nameKo: '케이' },
        { upper: 'L', lower: 'l', nameKo: '엘' },
        { upper: 'M', lower: 'm', nameKo: '엠' },
        { upper: 'N', lower: 'n', nameKo: '엔' },
        { upper: 'O', lower: 'o', nameKo: '오' },
        { upper: 'P', lower: 'p', nameKo: '피' },
        { upper: 'Q', lower: 'q', nameKo: '큐' },
        { upper: 'R', lower: 'r', nameKo: '아르' },
        { upper: 'S', lower: 's', nameKo: '에스' },
        { upper: 'T', lower: 't', nameKo: '티' },
        { upper: 'U', lower: 'u', nameKo: '유' },
        { upper: 'V', lower: 'v', nameKo: '브이' },
        { upper: 'W', lower: 'w', nameKo: '더블유' },
        { upper: 'X', lower: 'x', nameKo: '엑스' },
        { upper: 'Y', lower: 'y', nameKo: '와이' },
        { upper: 'Z', lower: 'z', nameKo: '제트' }
    ];

    const ALPHABET_DATA = LETTER_INFO.flatMap(info => ([
        {
            char: info.upper,
            nameKo: info.nameKo,
            caseLabel: '대문자',
            key: `${info.upper}-upper`
        },
        {
            char: info.lower,
            nameKo: info.nameKo,
            caseLabel: '소문자',
            key: `${info.lower}-lower`
        }
    ]));

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
        if (!isAlphabetPage()) return;
        cacheElements();
        attachEventListeners();
        resetUI();
    });

    function isAlphabetPage() {
        const file = window.location.pathname.split('/').pop();
        return file === 'alphabet-speed.html';
    }

    function cacheElements() {
        elements.roundInput = document.getElementById('alphabet-round-count');
        elements.timeLimit = document.getElementById('alphabet-time-limit');
        elements.timeLimitValue = document.getElementById('alphabet-time-limit-value');
        elements.randomizeTime = document.getElementById('alphabet-randomize-time');
        elements.startBtn = document.getElementById('alphabet-start');
        elements.gameCard = document.getElementById('alphabet-game');
        elements.resultsCard = document.getElementById('alphabet-results');
        elements.restartBtn = document.getElementById('alphabet-restart');
        elements.roundIndicator = document.getElementById('alphabet-round-indicator');
        elements.score = document.getElementById('alphabet-score');
        elements.timerFill = document.getElementById('alphabet-timer-fill');
        elements.timerValue = document.getElementById('alphabet-timer-value');
        elements.questionChar = document.getElementById('alphabet-char');
        elements.options = document.getElementById('alphabet-options');
        elements.feedback = document.getElementById('alphabet-feedback');
        elements.resultsSummary = document.getElementById('alphabet-results-summary');
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
        return shuffleArray([...ALPHABET_DATA]);
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
        elements.questionChar.textContent = state.currentQuestion.char;
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
        const candidates = shuffleArray(ALPHABET_DATA.filter(item => item.key !== correct.key)).slice(0, 4);
        const options = shuffleArray([correct, ...candidates]);
        const fragment = document.createDocumentFragment();

        state.optionButtons = options.map((item, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-btn';
            btn.dataset.key = item.key;
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
        const selectedKey = button.dataset.key;
        const isCorrect = selectedKey === state.currentQuestion.key;

        revealOptions(selectedKey);
        updateFeedback(isCorrect);

        if (isCorrect) {
            state.score += 1;
            elements.score.textContent = String(state.score);
        }

        scheduleNextQuestion();
    }

    function revealOptions(selectedKey) {
        state.optionButtons.forEach(btn => {
            const isOptionCorrect = btn.dataset.key === state.currentQuestion.key;
            btn.classList.toggle('correct', isOptionCorrect);
            if (!isOptionCorrect && btn.dataset.key === selectedKey) {
                btn.classList.add('incorrect');
            }
            btn.disabled = true;
        });
    }

    function updateFeedback(isCorrect) {
        const message = isCorrect
            ? '정답입니다! 멋져요 👍'
            : `오답이에요. 정답은 ${formatOptionLabel(state.currentQuestion)} 입니다.`;
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
        return item.nameKo;
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
