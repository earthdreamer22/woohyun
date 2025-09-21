// 신우현의 홈페이지 - JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 네비게이션 햄버거 메뉴
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    // 부드러운 스크롤
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 페이지 로딩 애니메이션
    const cards = document.querySelectorAll('.card');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // iframe 로딩 상태 관리
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.addEventListener('load', function() {
            const loader = this.parentElement.querySelector('.loading');
            if (loader) {
                loader.style.display = 'none';
            }
        });
    });
});

// 외부 링크 열기 함수
function openExternalLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

// 페이지별 특별 기능
function initializePageFeatures() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch(currentPage) {
        case 'baseball.html':
            initializeBaseballPage();
            break;
        case 'baduk.html':
            initializeBadukPage();
            break;
        case 'lottery.html':
            initializeLotteryPage();
            break;
        default:
            break;
    }
}

function initializeBaseballPage() {
    console.log('프로야구 페이지 초기화');
    // 야구 관련 특별 기능이 필요하면 여기에 추가
}

function initializeBadukPage() {
    console.log('바둑 페이지 초기화');
    // 바둑 관련 특별 기능이 필요하면 여기에 추가
}

function initializeLotteryPage() {
    console.log('뽑기게임 페이지 초기화');
    // 뽑기게임 관련 특별 기능이 필요하면 여기에 추가
}

// 페이지 로드 완료 후 초기화
window.addEventListener('load', function() {
    initializePageFeatures();
    
    // 모든 이미지 로딩 완료 후 애니메이션 시작
    const images = document.querySelectorAll('img');
    let loadedImages = 0;
    
    if (images.length === 0) {
        document.body.classList.add('loaded');
        return;
    }
    
    images.forEach(img => {
        if (img.complete) {
            loadedImages++;
        } else {
            img.addEventListener('load', () => {
                loadedImages++;
                if (loadedImages === images.length) {
                    document.body.classList.add('loaded');
                }
            });
        }
    });
    
    if (loadedImages === images.length) {
        document.body.classList.add('loaded');
    }
});

// 에러 처리
window.addEventListener('error', function(e) {
    console.error('페이지 오류:', e.error);
});

// 반응형 네비게이션 개선
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    const hamburger = document.querySelector('.hamburger');
    
    navLinks.classList.toggle('mobile-active');
    hamburger.classList.toggle('active');
}

// 모바일에서 메뉴 링크 클릭 시 메뉴 닫기
document.addEventListener('click', function(e) {
    const navLinks = document.querySelector('.nav-links');
    const hamburger = document.querySelector('.hamburger');
    const isNavLink = e.target.closest('.nav-links a');
    const isHamburger = e.target.closest('.hamburger');
    
    if (isNavLink && navLinks.classList.contains('mobile-active')) {
        navLinks.classList.remove('mobile-active');
        hamburger.classList.remove('active');
    } else if (!isHamburger && !e.target.closest('.nav-links')) {
        navLinks.classList.remove('mobile-active');
        hamburger.classList.remove('active');
    }
});