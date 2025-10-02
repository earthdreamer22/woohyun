// 패스워드 게임 기능 구현
(function() {
    // DOM 요소
    const passwordDisplay = document.getElementById('passwordDots');
    const modeBadge = document.getElementById('modeBadge');
    const modeInstruction = document.getElementById('modeInstruction');
    const resultMessage = document.getElementById('resultMessage');
    const clearBtn = document.getElementById('clearBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const keyButtons = document.querySelectorAll('.key-btn[data-value]');

    // 상태 변수
    let savedPassword = '';
    let currentInput = '';
    let isParentMode = true;

    // 숫자 버튼 클릭 이벤트
    keyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const value = this.dataset.value;
            addNumber(value);
        });
    });

    // 지우기 버튼
    clearBtn.addEventListener('click', function() {
        clearInput();
    });

    // 확인 버튼
    confirmBtn.addEventListener('click', function() {
        handleConfirm();
    });

    // 숫자 입력 처리
    function addNumber(num) {
        if (currentInput.length < 12) { // 최대 12자리
            currentInput += num;
            updateDisplay();
        }
    }

    // 입력 지우기
    function clearInput() {
        currentInput = '';
        updateDisplay();
        hideResultMessage();
    }

    // 화면 업데이트
    function updateDisplay() {
        // 입력된 숫자를 ● 으로 표시
        passwordDisplay.innerHTML = currentInput
            .split('')
            .map(() => '●')
            .join('');

        // 입력이 없으면 빈 상태 유지
        if (currentInput === '') {
            passwordDisplay.innerHTML = '';
        }
    }

    // 확인 버튼 처리
    function handleConfirm() {
        if (currentInput === '') {
            showResultMessage('숫자를 입력해주세요', 'error');
            return;
        }

        if (isParentMode) {
            // 부모 모드: 패스워드 설정
            savedPassword = currentInput;
            currentInput = '';
            updateDisplay();
            switchToChildMode();
            showResultMessage(`패스워드가 설정되었습니다 (${savedPassword.length}자리)`, 'success');
        } else {
            // 아이 모드: 패스워드 확인
            checkPassword();
        }
    }

    // 아이 모드로 전환
    function switchToChildMode() {
        isParentMode = false;
        modeBadge.textContent = '아이 모드';
        modeBadge.style.background = 'var(--green)';
        modeInstruction.textContent = '패스워드를 입력해보세요';
    }

    // 부모 모드로 전환
    function switchToParentMode() {
        isParentMode = true;
        savedPassword = '';
        modeBadge.textContent = '부모 모드';
        modeBadge.style.background = 'var(--deep-blue)';
        modeInstruction.textContent = '패스워드를 입력하고 확인을 누르세요';
    }

    // 패스워드 확인
    function checkPassword() {
        if (currentInput === savedPassword) {
            // 정답
            showResultMessage('🎉 정답입니다! 축하해요!', 'success');

            // 3초 후 다시 부모 모드로
            setTimeout(() => {
                currentInput = '';
                updateDisplay();
                switchToParentMode();
                hideResultMessage();
            }, 3000);
        } else {
            // 오답
            showResultMessage('❌ 틀렸습니다. 다시 해보세요!', 'error');
            currentInput = '';
            updateDisplay();

            // 2초 후 메시지 제거
            setTimeout(() => {
                hideResultMessage();
            }, 2000);
        }
    }

    // 결과 메시지 표시
    function showResultMessage(message, type) {
        resultMessage.textContent = message;
        resultMessage.className = `result-message ${type}`;
    }

    // 결과 메시지 숨기기
    function hideResultMessage() {
        resultMessage.textContent = '';
        resultMessage.className = 'result-message';
    }

    // 키보드 입력 지원 (선택사항)
    document.addEventListener('keydown', function(e) {
        // 숫자 키
        if (e.key >= '0' && e.key <= '9') {
            addNumber(e.key);
        }
        // Backspace
        else if (e.key === 'Backspace') {
            currentInput = currentInput.slice(0, -1);
            updateDisplay();
        }
        // Enter
        else if (e.key === 'Enter') {
            handleConfirm();
        }
        // Escape (지우기)
        else if (e.key === 'Escape') {
            clearInput();
        }
    });

    // 페이지에 body 클래스 추가
    document.body.classList.add('page-passwordgame');
})();
