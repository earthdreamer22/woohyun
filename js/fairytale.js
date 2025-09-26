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

    async function generateStory({ generateButton, statusElement, storyContainer, placeholder }) {
        state.generating = true;
        const originalText = generateButton.textContent;
        generateButton.textContent = '생성 중...';
        updateGenerateState(generateButton, statusElement);

        try {
            const response = await fetch(FAIRYTALE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keywords: state.keywords,
                    mood: state.mood
                })
            });

            if (!response.ok) {
                throw new Error(`서버 오류: ${response.status}`);
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
            statusElement.textContent = '멋진 동화가 완성되었어요! 마음에 들지 않으면 키워드나 분위기를 바꿔 다시 시도해보세요.';
        } catch (error) {
            console.error('동화 생성 실패', error);
            statusElement.textContent = '동화를 만들지 못했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.';
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
})();
