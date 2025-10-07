(function() {
    const KEYWORD_COUNT = 5;
    const DEFAULT_ENDPOINT = 'https://woohyun-homepage.vercel.app/api/fairytale';
    const FAIRYTALE_ENDPOINT = window.__GEMINI_STORY_PROXY__ || window.__GEMINI_PROXY__ || DEFAULT_ENDPOINT;

    const state = {
        keywords: Array(KEYWORD_COUNT).fill(''),
        mood: '',
        generating: false
    };

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('fairytale-form');
        const keywordInputs = Array.from(document.querySelectorAll('input[data-keyword-index]'));
        const moodButtons = Array.from(document.querySelectorAll('.story-mood-button'));
        const generateButton = document.getElementById('story-generate');
        const statusElement = document.getElementById('story-status');
        const storyContainer = document.getElementById('story-output');
        const placeholder = document.getElementById('story-placeholder');

        if (!form || !generateButton || keywordInputs.length !== KEYWORD_COUNT || !statusElement) {
            console.warn('동화 생성 폼 초기화에 필요한 요소를 찾을 수 없습니다.');
            return;
        }

        keywordInputs.forEach(input => {
            const index = Number(input.dataset.keywordIndex);
            if (!Number.isInteger(index) || index < 0 || index >= KEYWORD_COUNT) {
                return;
            }
            input.addEventListener('input', () => {
                state.keywords[index] = input.value.trim();
                updateGenerateState(generateButton, statusElement);
            });
        });

        moodButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mood = button.dataset.mood;
                if (!mood) {
                    return;
                }
                state.mood = mood;
                moodButtons.forEach(item => {
                    const isActive = item === button;
                    item.classList.toggle('is-selected', isActive);
                    item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
                updateGenerateState(generateButton, statusElement);
            });
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (generateButton.disabled || state.generating) {
                return;
            }
            generateStory({
                generateButton,
                statusElement,
                storyContainer,
                placeholder
            });
        });

        updateGenerateState(generateButton, statusElement);
    });

    function updateGenerateState(generateButton, statusElement) {
        const allKeywordsFilled = state.keywords.every(Boolean);
        const hasMood = Boolean(state.mood);
        const ready = allKeywordsFilled && hasMood && !state.generating;

        generateButton.disabled = !ready;

        if (state.generating) {
            statusElement.textContent = '동화를 생성하는 중입니다. 잠시만 기다려주세요...';
            return;
        }

        if (!allKeywordsFilled) {
            statusElement.textContent = '모든 키워드를 입력해주세요. 단어는 무엇이든 좋아요!';
            return;
        }

        if (!hasMood) {
            statusElement.textContent = '분위기 버튼 중 하나를 선택하면 동화를 만들 수 있어요.';
            return;
        }

        statusElement.textContent = '이제 동화를 만들 준비가 되었어요! “동화 생성” 버튼을 눌러보세요.';
    }

    async function generateStory({ generateButton, statusElement, storyContainer, placeholder }, retryCount = 0) {
        const MAX_RETRIES = 2;
        state.generating = true;
        const originalText = generateButton.textContent;
        generateButton.textContent = retryCount > 0 ? `재시도 중 (${retryCount}/${MAX_RETRIES})...` : '생성 중...';
        updateGenerateState(generateButton, statusElement);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90초 타임아웃 (모바일 고려)

            const response = await fetch(FAIRYTALE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keywords: state.keywords,
                    mood: state.mood
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);

                // 504 타임아웃 또는 503 에러인 경우 재시도
                if ((response.status === 504 || response.status === 503) && retryCount < MAX_RETRIES) {
                    statusElement.textContent = `서버가 응답하지 않아 재시도합니다... (${retryCount + 1}/${MAX_RETRIES})`;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
                    return generateStory({ generateButton, statusElement, storyContainer, placeholder }, retryCount + 1);
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            const story = typeof data?.story === 'string' ? data.story.trim() : '';
            if (!story) {
                throw new Error('동화 내용이 비어 있습니다.');
            }

            renderStory(storyContainer, story);
            if (placeholder) {
                placeholder.hidden = true;
            }

            // 저장 버튼 표시
            const saveSectionEl = document.getElementById('story-save-section');
            const saveBtnEl = document.getElementById('save-fairytale-btn');
            if (saveSectionEl) {
                saveSectionEl.style.display = 'block';
                if (saveBtnEl) {
                    saveBtnEl.disabled = false;
                    saveBtnEl.textContent = '💾 동화 저장';
                }
            }

            statusElement.textContent = '멋진 동화가 완성되었어요! 마음에 들지 않으면 키워드나 분위기를 바꿔 다시 시도해보세요.';
        } catch (error) {
            console.error('동화 생성 실패', error);

            // AbortError는 타임아웃 의미
            if (error.name === 'AbortError' && retryCount < MAX_RETRIES) {
                statusElement.textContent = `요청 시간이 초과되어 재시도합니다... (${retryCount + 1}/${MAX_RETRIES})`;
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
                return generateStory({ generateButton, statusElement, storyContainer, placeholder }, retryCount + 1);
            }

            if (error.name === 'AbortError') {
                statusElement.textContent = '요청 시간이 초과되었습니다. 서버가 바쁠 수 있으니 잠시 후 다시 시도해주세요.';
            } else if (retryCount >= MAX_RETRIES) {
                statusElement.textContent = `${MAX_RETRIES}번 시도했지만 실패했습니다. 잠시 후 다시 시도해주세요.`;
            } else {
                statusElement.textContent = '동화를 만들지 못했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.';
            }
        } finally {
            state.generating = false;
            generateButton.textContent = originalText;
            updateGenerateState(generateButton, statusElement);
        }
    }

    function renderStory(container, story) {
        if (!container) {
            return;
        }
        container.innerHTML = '';
        const paragraphs = story
            .split(/\n{2,}/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean);

        if (!paragraphs.length) {
            paragraphs.push(story.trim());
        }

        paragraphs.forEach(text => {
            const p = document.createElement('p');
            p.textContent = text;
            container.appendChild(p);
        });
    }

    async function extractErrorMessage(response) {
        const fallback = `서버 오류: ${response.status}`;
        const contentType = response.headers.get('content-type') || '';
        try {
            if (contentType.includes('application/json')) {
                const payload = await response.json();
                if (payload?.error && payload?.details) {
                    return `${payload.error} (${payload.details})`;
                }
                if (payload?.error) {
                    return String(payload.error);
                }
            } else {
                const text = (await response.text()).trim();
                if (text) {
                    return `${fallback} - ${text}`;
                }
            }
        } catch (error) {
            console.error('오류 응답 파싱 실패', error);
        }
        return fallback;
    }

})();
