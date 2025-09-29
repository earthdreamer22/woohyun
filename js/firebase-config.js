// Firebase 설정 및 초기화
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyC5V6aG1LK6LjqJfNUX1vVBBiPOPPDc--w",
  authDomain: "letters-25368.firebaseapp.com",
  projectId: "letters-25368",
  storageBucket: "letters-25368.firebasestorage.app",
  messagingSenderId: "342456142331",
  appId: "1:342456142331:web:0000c9b9d766984d39235e"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 익명 로그인
signInAnonymously(auth).catch((error) => {
  console.error('익명 로그인 실패:', error);
});

// 전역 변수로 내보내기
window.firebaseDB = db;
window.firebaseAuth = auth;

export { db, auth };