// japanese.js - Gemini 기반 일본어 단어 객관식 퀴즈 로직
(function() {
    const QUIZ_COUNT = 5;
    const QUIZ_STORAGE_KEY = 'japaneseQuizCache:v1';
    // window.__GEMINI_PROXY__ 값을 지정하면 다른 프록시 주소로 덮어쓸 수 있습니다.
    const DEFAULT_ENDPOINT = 'https://woohyun-homepage.vercel.app/api/gemini';
    const QUIZ_ENDPOINT = window.__GEMINI_PROXY__ || DEFAULT_ENDPOINT;

    const state = {
        questions: [],
        answers: new Map(),
        lockAnswers: false
    };

    document.addEventListener('DOMContentLoaded', () => {
        const fetchBtn = document.getElementById('quiz-fetch');
        const retryBtn = document.getElementById('quiz-retry');
        const form = document.getElementById('quiz-form');

        if (fetchBtn) {
            fetchBtn.addEventListener('click', () => {
                fetchQuiz();
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                resetSelections();
                toggleResults(false);
                enableForm(true);
                scrollToQuizTop();
            });
        }

        if (form) {
            form.addEventListener('submit', handleSubmit);
            form.addEventListener('change', handleChange);
        }

        const cached = loadCachedQuiz();
        if (cached?.questions?.length) {
            state.questions = cached.questions;
            renderQuiz();
            updateStatus('이전에 불러온 문제를 다시 표시합니다. 정답을 제출해보세요.');
            toggleForm(true);
        }
    });

    function fetchQuiz() {
        setLoading(true, '문제를 불러오는 중입니다...');
        toggleResults(false);
        enableForm(false);

        fetch(QUIZ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count: QUIZ_COUNT })
        })
            .then(assertOk)
            .then(res => res.json())
            .then(data => {
                const questions = Array.isArray(data?.items) ? data.items : [];
                if (!questions.length) {
                    throw new Error('문제 데이터를 찾을 수 없습니다.');
                }
                state.questions = questions.map(normalizeQuestion).filter(Boolean).slice(0, QUIZ_COUNT);
                saveCachedQuiz(state.questions);
                renderQuiz();
                resetSelections();
                toggleForm(true);
                enableForm(true);
                updateStatus('문제를 불러왔습니다. 정답을 선택해보세요.');
                scrollToQuizTop();
            })
            .catch(error => {
                console.error('Quiz fetch error', error);
                updateStatus('문제를 불러오지 못했습니다. 잠시 후 다시 시도하거나 네트워크 상태를 확인하세요.');
            })
            .finally(() => {
                setLoading(false);
            });
    }

    function normalizeQuestion(raw) {
        if (!raw) return null;
        const word = String(raw.word || raw.term || '').trim();
        const reading = String(raw.reading || raw.furigana || raw.kana || '').trim();
        const meaning = String(raw.meaning || raw.translation || raw.correct || '').trim();
        let choices = Array.isArray(raw.choices) ? raw.choices.filter(Boolean) : [];
        const explanation = String(raw.explanation || '').trim();

        if (!word || !meaning) {
            return null;
        }

        if (!choices.length) {
            const pool = Array.isArray(raw.distractors) ? raw.distractors.slice(0, 3) : [];
            choices = [meaning, ...pool];
        }

        choices = Array.from(new Set(choices.map(choice => String(choice).trim()).filter(Boolean)));

        if (!choices.includes(meaning)) {
            choices.unshift(meaning);
        }

        if (choices.length < 4) {
            const filler = ['공원', '학생', '선생님', '과일', '바다', '책', '음악', '친구'];
            let index = 0;
            while (choices.length < 4 && index < filler.length) {
                if (!choices.includes(filler[index])) {
                    choices.push(filler[index]);
                }
                index += 1;
            }
        }

        const shuffled = shuffleArray(choices);
        const correctIndex = shuffled.findIndex(choice => choice === meaning);

        return {
            word,
            reading,
            meaning,
            choices: shuffled,
            correctIndex: correctIndex >= 0 ? correctIndex : 0,
            explanation
        };
    }

    function renderQuiz() {
        const form = document.getElementById('quiz-form');
        const container = document.getElementById('quiz-questions');
        const retryBtn = document.getElementById('quiz-retry');

        if (!form || !container) return;

        if (!state.questions.length) {
            form.hidden = true;
            if (retryBtn) {
                retryBtn.hidden = true;
            }
            return;
        }

        const markup = state.questions.map((question, index) => {
            const questionNumber = index + 1;
            return [
                `<section class="quiz-question" data-question-index="${index}">`,
                `<h3 class="quiz-question-title">${questionNumber}. ${escapeHtml(question.word)}</h3>`,
                `<p class="quiz-question-reading">${question.reading ? escapeHtml(question.reading) : '읽기 정보 없음'}</p>`,
                '<div class="quiz-options">',
                question.choices.map((choice, optionIndex) => [
                    `<label class="quiz-option" data-option-index="${optionIndex}">`,
                    `<input type="radio" name="question-${index}" value="${optionIndex}" aria-label="${escapeHtml(choice)}">`,
                    `<span class="quiz-option-text">${escapeHtml(choice)}</span>`,
                    '</label>'
                ].join('')).join(''),
                '</div>',
                '</section>'
            ].join('');
        }).join('');

        container.innerHTML = markup;
        form.hidden = false;

        const retryButton = document.getElementById('quiz-retry');
        if (retryButton) {
            retryButton.hidden = true;
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!state.questions.length) {
            updateStatus('먼저 문제를 불러와 주세요.');
            return;
        }

        const form = event.currentTarget;
        const answers = [];
        const unanswered = [];

        state.questions.forEach((_, index) => {
            const selected = form.querySelector(`input[name="question-${index}"]:checked`);
            if (!selected) {
                unanswered.push(index);
            } else {
                answers[index] = Number(selected.value);
            }
        });

        if (unanswered.length) {
            updateStatus('모든 문항에 답한 뒤 제출해주세요.');
            const firstUnanswered = form.querySelector(`.quiz-question[data-question-index="${unanswered[0]}"]`);
            if (firstUnanswered) {
                firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        state.lockAnswers = true;
        enableForm(false);

        let correctCount = 0;
        const feedbackItems = [];

        state.questions.forEach((question, index) => {
            const selectedIndex = answers[index];
            const questionNode = form.querySelector(`.quiz-question[data-question-index="${index}"]`);
            if (!questionNode) return;

            const optionNodes = questionNode.querySelectorAll('.quiz-option');
            optionNodes.forEach(optionNode => {
                optionNode.classList.remove('correct', 'incorrect', 'selected');
                const radio = optionNode.querySelector('input[type="radio"]');
                if (radio) {
                    radio.disabled = true;
                }
                const optionIndex = Number(optionNode.getAttribute('data-option-index'));
                if (optionIndex === question.correctIndex) {
                    optionNode.classList.add('correct');
                }
                if (optionIndex === selectedIndex && optionIndex !== question.correctIndex) {
                    optionNode.classList.add('incorrect', 'selected');
                }
            });

            const isCorrect = selectedIndex === question.correctIndex;
            if (isCorrect) {
                correctCount += 1;
            }

            const selectedText = question.choices[selectedIndex];
            const correctText = question.choices[question.correctIndex];

            feedbackItems.push({
                word: question.word,
                reading: question.reading,
                correct: correctText,
                selected: selectedText,
                explanation: question.explanation,
                isCorrect
            });
        });

        renderResults(correctCount, feedbackItems);
        updateStatus('채점이 완료되었습니다. 결과를 확인해보세요.');

        const retryButton = document.getElementById('quiz-retry');
        if (retryButton) {
            retryButton.hidden = false;
        }

        const resultCard = document.getElementById('quiz-result');
        if (resultCard) {
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function handleChange(event) {
        if (!event.target.matches('input[type="radio"]')) {
            return;
        }
        updateStatus('정답 제출 버튼을 눌러 결과를 확인하세요.');
    }

    function renderResults(correctCount, feedbackItems) {
        const scoreText = document.getElementById('quiz-score');
        const feedbackContainer = document.getElementById('quiz-feedback');
        const resultCard = document.getElementById('quiz-result');

        if (!scoreText || !feedbackContainer || !resultCard) {
            return;
        }

        const total = state.questions.length || feedbackItems.length;
        scoreText.textContent = `총 ${total}문제 중 ${correctCount}문제를 맞혔습니다.`;

        const feedbackMarkup = feedbackItems.map(item => {
            const readingText = item.reading ? ` (${escapeHtml(item.reading)})` : '';
            const correctness = item.isCorrect ? '✅ 정답!' : '❌ 오답';
            const selectedInfo = item.isCorrect
                ? '잘하셨어요!'
                : `선택한 뜻: ${escapeHtml(item.selected || '선택 없음')}`;
            const explanation = item.explanation ? `<p>${escapeHtml(item.explanation)}</p>` : '';
            return [
                '<div class="quiz-feedback-item">',
                `<h3>${escapeHtml(item.word)}${readingText}</h3>`,
                `<p>${correctness} · 정답: ${escapeHtml(item.correct)}</p>`,
                `<p>${selectedInfo}</p>`,
                explanation,
                '</div>'
            ].join('');
        }).join('');

        feedbackContainer.innerHTML = feedbackMarkup;
        toggleResults(true);
    }

    function toggleForm(show) {
        const form = document.getElementById('quiz-form');
        if (form) {
            form.hidden = !show;
        }
    }

    function toggleResults(show) {
        const resultCard = document.getElementById('quiz-result');
        if (resultCard) {
            resultCard.hidden = !show;
        }
    }

    function enableForm(enable) {
        const form = document.getElementById('quiz-form');
        if (!form) return;
        const inputs = form.querySelectorAll('input[type="radio"]');
        inputs.forEach(input => {
            input.disabled = !enable;
            if (enable) {
                input.checked = false;
            }
        });
        const submitBtn = document.getElementById('quiz-submit');
        if (submitBtn) {
            submitBtn.disabled = !enable;
        }
    }

    function resetSelections() {
        state.answers.clear();
        state.lockAnswers = false;
        enableForm(true);
        const form = document.getElementById('quiz-form');
        if (!form) return;
        const optionNodes = form.querySelectorAll('.quiz-option');
        optionNodes.forEach(option => {
            option.classList.remove('correct', 'incorrect', 'selected');
        });
    }

    function setLoading(isLoading, message) {
        const fetchBtn = document.getElementById('quiz-fetch');
        const status = document.getElementById('quiz-status');
        if (fetchBtn) {
            fetchBtn.disabled = isLoading;
            fetchBtn.textContent = isLoading ? '불러오는 중...' : '새 문제 불러오기';
        }
        if (status && message) {
            status.textContent = message;
        }
    }

    function updateStatus(message) {
        const status = document.getElementById('quiz-status');
        if (status) {
            status.textContent = message;
        }
    }

    function assertOk(response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response;
    }

    function shuffleArray(array) {
        const cloned = array.slice();
        for (let i = cloned.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
        }
        return cloned;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function saveCachedQuiz(questions) {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return;
        }
        try {
            const payload = {
                timestamp: Date.now(),
                questions
            };
            window.sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Quiz cache save failed', error);
        }
    }

    function loadCachedQuiz() {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return null;
        }
        try {
            const raw = window.sessionStorage.getItem(QUIZ_STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (error) {
            console.warn('Quiz cache load failed', error);
            return null;
        }
    }

    function scrollToQuizTop() {
        const section = document.getElementById('japanese-quiz');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
})();
