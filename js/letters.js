// 편지쓰기 기능
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM 요소들
let letterForm, letterTitle, letterContent, letterAuthor, lettersContainer, loadingSpinner, charCounter;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소 선택
    letterForm = document.getElementById('letter-form');
    letterTitle = document.getElementById('letter-title');
    letterContent = document.getElementById('letter-content');
    letterAuthor = document.getElementById('letter-author');
    lettersContainer = document.getElementById('letters-container');
    loadingSpinner = document.getElementById('loading');
    charCounter = document.getElementById('char-counter');

    // 이벤트 리스너 설정
    setupEventListeners();
    
    // Firebase 연결 대기 후 편지 목록 로드
    waitForFirebase();
});

function waitForFirebase() {
    if (window.firebaseDB && window.firebaseAuth) {
        loadLetters();
    } else {
        setTimeout(waitForFirebase, 100);
    }
}

function setupEventListeners() {
    // 편지 폼 제출
    if (letterForm) {
        letterForm.addEventListener('submit', handleLetterSubmit);
    }

    // 취소 버튼
    const cancelBtn = document.getElementById('cancel-letter');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', clearForm);
    }

    // 글자 수 카운터
    if (letterContent && charCounter) {
        letterContent.addEventListener('input', updateCharCounter);
    }

    // 이모티콘 버튼들
    const emojiButtons = document.querySelectorAll('.emoji-btn');
    emojiButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const emoji = this.dataset.emoji;
            insertEmoji(emoji);
        });
    });
}

function updateCharCounter() {
    const currentLength = letterContent.value.length;
    charCounter.textContent = currentLength;
    
    if (currentLength > 900) {
        charCounter.style.color = '#ef4444';
    } else {
        charCounter.style.color = '#6b7280';
    }
}

function insertEmoji(emoji) {
    const cursorPos = letterContent.selectionStart;
    const textBefore = letterContent.value.substring(0, cursorPos);
    const textAfter = letterContent.value.substring(cursorPos);
    
    letterContent.value = textBefore + emoji + textAfter;
    letterContent.focus();
    letterContent.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    
    updateCharCounter();
}

async function handleLetterSubmit(e) {
    e.preventDefault();
    
    const title = letterTitle.value.trim();
    const content = letterContent.value.trim();
    const author = letterAuthor.value.trim() || '익명';

    if (!title || !content) {
        alert('제목과 내용을 모두 입력해주세요.');
        return;
    }

    try {
        showLoading(true);
        
        const letterData = {
            title: title,
            content: content,
            author: author,
            createdAt: serverTimestamp(),
            replyCount: 0
        };

        await addDoc(collection(window.firebaseDB, 'letters'), letterData);
        
        clearForm();
        showMessage('편지가 성공적으로 전송되었습니다! 💌');
        
    } catch (error) {
        console.error('편지 전송 실패:', error);
        alert('편지 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
        showLoading(false);
    }
}

function clearForm() {
    letterForm.reset();
    updateCharCounter();
}

function showLoading(show) {
    if (loadingSpinner) {
        loadingSpinner.style.display = show ? 'block' : 'none';
    }
}

function showMessage(message) {
    // 간단한 메시지 표시
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

async function loadLetters() {
    try {
        const lettersQuery = query(
            collection(window.firebaseDB, 'letters'),
            orderBy('createdAt', 'desc')
        );

        // 실시간 업데이트를 위한 리스너
        onSnapshot(lettersQuery, (snapshot) => {
            displayLetters(snapshot.docs);
            updateLettersCount(snapshot.docs.length);
        });

    } catch (error) {
        console.error('편지 로드 실패:', error);
        lettersContainer.innerHTML = '<p class="error-message">편지를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

function displayLetters(letterDocs) {
    if (!lettersContainer) return;

    if (letterDocs.length === 0) {
        lettersContainer.innerHTML = `
            <div class="no-letters">
                <p>📭 아직 편지가 없어요.</p>
                <p>첫 번째 편지를 써보세요!</p>
            </div>
        `;
        return;
    }

    lettersContainer.innerHTML = '';
    
    letterDocs.forEach(doc => {
        const letter = doc.data();
        const letterElement = createLetterElement(doc.id, letter);
        lettersContainer.appendChild(letterElement);
    });
}

function createLetterElement(letterId, letter) {
    const div = document.createElement('div');
    div.className = 'letter-card';
    div.dataset.letterId = letterId;

    const createdAt = letter.createdAt ? 
        new Date(letter.createdAt.seconds * 1000).toLocaleString('ko-KR') : 
        '방금 전';

    div.innerHTML = `
        <div class="letter-header">
            <h3 class="letter-title">${escapeHtml(letter.title)}</h3>
            <div class="letter-meta">
                <span class="letter-author">by ${escapeHtml(letter.author)}</span>
                <span class="letter-date">${createdAt}</span>
            </div>
        </div>
        <div class="letter-content">
            <p>${escapeHtml(letter.content).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="letter-actions">
            <button class="btn btn-outline reply-btn" data-letter-id="${letterId}">
                💬 답장하기 (${letter.replyCount || 0})
            </button>
        </div>
        <div class="replies-section" id="replies-${letterId}" style="display: none;">
            <!-- 답장들이 여기에 동적으로 추가됩니다 -->
        </div>
    `;

    // 답장 버튼 이벤트
    const replyBtn = div.querySelector('.reply-btn');
    replyBtn.addEventListener('click', () => toggleReplies(letterId));

    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateLettersCount(count) {
    const countElement = document.getElementById('letters-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

async function toggleReplies(letterId) {
    const repliesSection = document.getElementById(`replies-${letterId}`);
    if (!repliesSection) return;

    if (repliesSection.style.display === 'none') {
        repliesSection.style.display = 'block';
        await loadReplies(letterId);
    } else {
        repliesSection.style.display = 'none';
    }
}

async function loadReplies(letterId) {
    const repliesSection = document.getElementById(`replies-${letterId}`);
    if (!repliesSection) return;

    try {
        repliesSection.innerHTML = '<div class="loading-replies">답장을 불러오는 중...</div>';

        const repliesQuery = query(
            collection(window.firebaseDB, 'letters', letterId, 'replies'),
            orderBy('createdAt', 'asc')
        );

        const repliesSnapshot = await getDocs(repliesQuery);
        displayReplies(letterId, repliesSnapshot.docs);

    } catch (error) {
        console.error('답장 로드 실패:', error);
        repliesSection.innerHTML = '<div class="error-message">답장을 불러오는 중 오류가 발생했습니다.</div>';
    }
}

function displayReplies(letterId, replyDocs) {
    const repliesSection = document.getElementById(`replies-${letterId}`);
    if (!repliesSection) return;

    repliesSection.innerHTML = `
        <div class="replies-header">
            <h4>💬 답장들</h4>
        </div>
        <div class="replies-list" id="replies-list-${letterId}">
            ${replyDocs.length === 0 ? '<p class="no-replies">아직 답장이 없어요. 첫 번째 답장을 써보세요!</p>' : ''}
        </div>
        <div class="reply-form">
            <textarea placeholder="답장을 써보세요..." id="reply-content-${letterId}" maxlength="500" rows="3"></textarea>
            <div class="reply-form-actions">
                <input type="text" placeholder="작성자 (익명)" id="reply-author-${letterId}" maxlength="20">
                <button class="btn btn-primary" onclick="submitReply('${letterId}')">답장 보내기</button>
            </div>
        </div>
    `;

    const repliesList = document.getElementById(`replies-list-${letterId}`);
    
    replyDocs.forEach(doc => {
        const reply = doc.data();
        const replyElement = createReplyElement(reply);
        repliesList.appendChild(replyElement);
    });
}

function createReplyElement(reply) {
    const div = document.createElement('div');
    div.className = 'reply-item';

    const createdAt = reply.createdAt ? 
        new Date(reply.createdAt.seconds * 1000).toLocaleString('ko-KR') : 
        '방금 전';

    div.innerHTML = `
        <div class="reply-content">${escapeHtml(reply.content).replace(/\n/g, '<br>')}</div>
        <div class="reply-meta">
            <span class="reply-author">${escapeHtml(reply.author)}</span>
            <span class="reply-date">${createdAt}</span>
        </div>
    `;

    return div;
}

// 전역 함수로 답장 제출 (HTML에서 호출)
window.submitReply = async function(letterId) {
    const contentElement = document.getElementById(`reply-content-${letterId}`);
    const authorElement = document.getElementById(`reply-author-${letterId}`);
    
    if (!contentElement || !authorElement) return;

    const content = contentElement.value.trim();
    const author = authorElement.value.trim() || '익명';

    if (!content) {
        alert('답장 내용을 입력해주세요.');
        return;
    }

    try {
        const replyData = {
            content: content,
            author: author,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(window.firebaseDB, 'letters', letterId, 'replies'), replyData);

        // 편지의 답장 수 업데이트
        const letterRef = doc(window.firebaseDB, 'letters', letterId);
        const repliesSnapshot = await getDocs(collection(window.firebaseDB, 'letters', letterId, 'replies'));
        await updateDoc(letterRef, {
            replyCount: repliesSnapshot.docs.length + 1
        });

        // 폼 초기화
        contentElement.value = '';
        authorElement.value = '';

        // 답장 목록 새로고침
        await loadReplies(letterId);

        showMessage('답장이 성공적으로 전송되었습니다! 💬');

    } catch (error) {
        console.error('답장 전송 실패:', error);
        alert('답장 전송에 실패했습니다. 다시 시도해주세요.');
    }
};