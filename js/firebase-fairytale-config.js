// Firebase 설정 및 초기화 (동화 저장 전용)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDcmQ3vmoovLH4jBh9mZK1NBRsKeVwnrt0",
  authDomain: "fairytalesaved.firebaseapp.com",
  databaseURL: "https://fairytalesaved-default-rtdb.firebaseio.com",
  projectId: "fairytalesaved",
  storageBucket: "fairytalesaved.firebasestorage.app",
  messagingSenderId: "1075442133889",
  appId: "1:1075442133889:web:49781317805a0be43a9680"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig, 'fairytale-app');
const db = getFirestore(app);
const auth = getAuth(app);

// 익명 로그인
signInAnonymously(auth).catch((error) => {
  console.error('익명 로그인 실패:', error);
});

// 전역 변수로 내보내기
window.fairytaleDB = db;
window.fairytaleAuth = auth;

export { db, auth };
