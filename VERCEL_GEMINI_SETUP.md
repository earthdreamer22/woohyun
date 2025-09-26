# Vercel × Gemini 연동 정리

이 프로젝트는 정적 페이지(GitHub Pages)에서 Vercel 서버리스 함수를 호출해 Google Gemini API 기반 일본어 단어 퀴즈를 제공한다. 설정 및 사용법을 빠르게 확인할 수 있도록 주요 내용을 정리했다.

## 1. 전체 구성
- 프론트엔드: `japanese.html`, `js/japanese.js` 등 정적 파일은 GitHub Pages에서 제공.
- 백엔드(프록시): `api/gemini.js`는 Vercel 서버리스 함수로 배포되어 Gemini API 요청을 중계.
- 프론트 코드는 기본적으로 `https://woohyun-homepage.vercel.app/api/gemini` 엔드포인트를 호출한다.
  - 임시 서브 도메인(예: `-fy36ppocc-earth-shins-projects` 등)은 배포마다 바뀌므로 사용하지 않는다.
  - 필요하면 페이지에서 `window.__GEMINI_PROXY__ = '다른주소';` 를 지정해 교체 가능.

## 2. Vercel 프로젝트 생성 (CLI)
1. 프로젝트 루트에서 `vercel` 실행 → Git 연결 없이 새 프로젝트 생성.
2. 생성 후 기본 Production URL: `https://woohyun-homepage.vercel.app` (임시 서브 도메인은 매 배포마다 달라짐).
3. 서버리스 함수/CORS 수정 사항이 있을 때마다 `vercel --prod`로 재배포.

## 3. 환경 변수 (Gemini API Key)
- 기본 단어 난이도는 JLPT N3로 요청되며, 필요하면 API 본문에서 `level` 값을 원하는 JLPT 등급으로 바꿀 수 있습니다.
- `vercel env add GEMINI_API_KEY production`
- (Preview/Development 환경이 필요하면 동일 명령으로 추가 가능)
- 키는 절대 저장소에 커밋하지 말 것.
- 로컬 개발을 할 경우 `vercel env pull`로 `.vercel/.env.*`를 내려받아 사용.

## 4. 서버리스 함수 (`api/gemini.js`)
- Google Gemini REST API(`v1beta/models/<model>:generateContent`) 호출. 기본적으로 `gemini-1.5-flash-latest`를 시도하고, 접근 권한이 없을 경우 `gemini-1.5-flash-001` → `gemini-1.5-flash` → `gemini-1.0-pro` → `gemini-pro` 순으로 자동 대체합니다.
- JSON 파싱/보기 보정 후 `{ items: [...] }` 구조로 응답.
- CORS 지원: `Access-Control-Allow-Origin: *`, `OPTIONS` 프리플라이트 처리.
- 엔드포인트 예: `https://woohyun-homepage.vercel.app/api/gemini`

## 5. 프론트엔드 스크립트 (`js/japanese.js`)
- `DEFAULT_ENDPOINT`를 Vercel 프록시 주소로 설정.
- `window.__GEMINI_PROXY__` 값이 있으면 해당 주소를 사용.
- 퀴즈 UI 렌더링/채점/결과 표시 및 세션 캐시 기능 포함.

## 6. 자주 하는 작업
### 배포 갱신
```bash
git add <변경 파일>
git commit -m "메시지"
git push
vercel --prod
```

### 환경 변수 수정
```bash
vercel env ls
vercel env add GEMINI_API_KEY production
vercel env rm GEMINI_API_KEY production  # 필요 시 삭제
```

## 7. 참고
- Gemini 응답이 예상과 다를 경우 console/Vercel Logs에서 응답 전문을 확인 후 프롬프트나 파서 로직을 조정.
- GitHub Pages에서 호출 시 문제 발생하면 브라우저 개발자 도구 → Network 탭, 콘솔 에러로 원인 파악.

---
마지막 업데이트: vercel --prod 배포 후 (2024-XX-XX 기준 최신 상태).
