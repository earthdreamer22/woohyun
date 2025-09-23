// moon.js - 날씨와 달 위상 정보를 불러와 moon.html에 표시하는 스크립트
(function() {
    const WEATHER_ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';
    const WEATHER_API_KEY = 'bSXLOVZXJBTb5kP+LeHxYhdGontFNILjji6zaVtQu7Sd3U+NBp7nKIMuwf+xARrxS0Vl8oLD+NVpyjcTRMAFyA==';
    const MOON_ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/LunPhInfoService/getLunPhInfo';
    const MOON_API_KEY = 'bSXLOVZXJBTb5kP+LeHxYhdGontFNILjji6zaVtQu7Sd3U+NBp7nKIMuwf+xARrxS0Vl8oLD+NVpyjcTRMAFyA==';
    const SYNODIC_MONTH = 29.530588;
    const MOON_CACHE_KEY = 'moonPhaseCache:v1';
    let moonGraphicRenderCount = 0;
    const LESSON_PHASE_DATA = {
        new: { age: 0, isWaxing: true },
        waxing_crescent: { age: SYNODIC_MONTH * 0.1, isWaxing: true },
        first_quarter: { age: SYNODIC_MONTH * 0.25, isWaxing: true },
        full: { age: SYNODIC_MONTH * 0.5, isWaxing: true },
        last_quarter: { age: SYNODIC_MONTH * 0.75, isWaxing: false },
        waning_crescent: { age: SYNODIC_MONTH * 0.9, isWaxing: false }
    };

    const GRID = {
        nx: 89,
        ny: 91,
        latitude: 35.8762111111111,
        longitude: 128.602108333333
    };

    document.addEventListener('DOMContentLoaded', () => {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                setRefreshState(true);
                fetchAllData();
            });
        }
        hydrateStaticLocation();
        renderMoonLessonIcons();
        fetchAllData();
    });

    function hydrateStaticLocation() {
        updateText('latitude', GRID.latitude.toFixed(6));
        updateText('longitude', GRID.longitude.toFixed(6));
        updateText('grid-nx', GRID.nx);
        updateText('grid-ny', GRID.ny);
    }

    function fetchAllData() {
        fetchWeatherData();
        fetchMoonPhaseData();
    }

    function fetchWeatherData() {
        const { baseDate, baseTime, kstDate } = getLatestBaseTimestamp();
        const params = new URLSearchParams({
            serviceKey: WEATHER_API_KEY,
            dataType: 'JSON',
            pageNo: '1',
            numOfRows: '1000',
            base_date: baseDate,
            base_time: baseTime,
            nx: String(GRID.nx),
            ny: String(GRID.ny)
        });
        const url = `${WEATHER_ENDPOINT}?${params.toString()}`;
        updateText('weather-status', '기상청 API에 요청 중입니다...');

        fetch(url)
            .then(assertOk)
            .then(res => res.json())
            .then(parseWeatherResponse)
            .then(data => applyWeatherData(data, kstDate))
            .catch(err => handleWeatherError(err));
    }

    function parseWeatherResponse(json) {
        const header = json?.response?.header;
        if (header && header.resultCode !== '00') {
            throw new Error(`기상청 응답 오류: ${header.resultMsg || header.resultCode}`);
        }
        const items = json?.response?.body?.items?.item;
        if (!items || (Array.isArray(items) && items.length === 0)) {
            throw new Error('기상청 응답에 관측 데이터가 없습니다.');
        }
        const data = {};
        const list = Array.isArray(items) ? items : [items];
        list.forEach(item => {
            const category = item?.category;
            const value = item?.obsrValue;
            if (category) {
                data[String(category).trim()] = value;
            }
        });
        return data;
    }

    function applyWeatherData(data, timestamp) {
        const temperature = formatNumber(data.T1H);
        updateText('temperature', temperature !== null ? `${temperature}°C` : '--°C');

        const sensible = calculateSensibleTemperature(data);
        updateText('sensible-temp', sensible !== null ? `체감온도 ${sensible}°C` : '체감온도 정보를 계산할 수 없습니다');

        const rainfall = parseFloat(data.RN1);
        const rainfallText = Number.isFinite(rainfall) ? `${rainfall.toFixed(1)} mm` : (data.RN1 || '강수 없음');
        updateText('precipitation', rainfallText);

        const precipType = describePrecipitationType(data.PTY);
        updateText('precip-type', precipType);

        const humidity = formatNumber(data.REH);
        updateText('humidity', humidity !== null ? `${humidity}%` : '--%');

        const windSpeed = formatNumber(data.WSD, 1);
        updateText('wind', windSpeed !== null ? `풍속 ${windSpeed} m/s` : '풍속 정보 없음');

        const windDirection = describeWindDirection(data.VEC);
        updateText('wind-direction', windDirection);

        const sky = describeSkyCondition(data.SKY, precipType);
        updateText('sky', sky);

        updateText('weather-status', '데이터 업데이트가 완료되었습니다.');
        updateText('weather-updated', formatKST(timestamp));
        setRefreshState(false);
    }

    function handleWeatherError(err) {
        console.error('Weather API error', err);
        updateText('weather-status', '날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요. (브라우저 CORS 정책 영향을 받을 수 있습니다)');
        setRefreshState(false);
    }

    function fetchMoonPhaseData() {
        const kstNow = getKSTDate();
        const dateKey = formatDateKey(kstNow);
        const cachedState = readMoonCache(dateKey);

        if (cachedState) {
            applyMoonState(cachedState, { fromCache: true });
        }

        const params = new URLSearchParams({
            solYear: String(kstNow.getFullYear()),
            solMonth: String(kstNow.getMonth() + 1).padStart(2, '0'),
            solDay: String(kstNow.getDate()).padStart(2, '0'),
            serviceKey: MOON_API_KEY
        });
        const url = `${MOON_ENDPOINT}?${params.toString()}`;

        updateText('moon-status', cachedState ? '저장된 데이터를 바탕으로 최신 값을 확인하는 중입니다...' : '달 위상 API에 요청 중입니다...');

        fetch(url)
            .then(assertOk)
            .then(res => res.text())
            .then(parseMoonResponse)
            .then(raw => buildMoonState(raw, kstNow))
            .then(state => {
                applyMoonState(state);
                saveMoonCache(dateKey, state);
            })
            .catch(err => handleMoonError(err, cachedState));
    }

    function parseMoonResponse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('달 위상 응답을 해석하지 못했습니다.');
        }

        const header = doc.querySelector('header');
        const resultCode = header ? getNodeText(header, 'resultCode') : null;
        if (resultCode && resultCode !== '00') {
            const message = header ? getNodeText(header, 'resultMsg') : '';
            throw new Error(`달 위상 응답 오류: ${message || resultCode}`);
        }

        const itemNode = doc.querySelector('body items item');
        if (!itemNode) {
            throw new Error('달 위상 응답에 데이터가 없습니다.');
        }

        const data = {};
        Array.from(itemNode.children).forEach(child => {
            const key = child.tagName ? child.tagName.toLowerCase() : '';
            if (key) {
                data[key] = child.textContent.trim();
            }
        });
        return data;
    }

    function buildMoonState(raw, timestamp) {
        const ageValue = parseFloat(raw.lunage ?? raw.lunageday ?? raw.age);
        const normalizedAge = normalizeLunarAge(ageValue);
        const phaseAngle = Number.isFinite(normalizedAge) ? (2 * Math.PI * normalizedAge) / SYNODIC_MONTH : null;
        const illuminatedFraction = Number.isFinite(phaseAngle) ? clamp((1 - Math.cos(phaseAngle)) / 2, 0, 1) : null;
        const percentIlluminated = illuminatedFraction !== null ? Math.round(illuminatedFraction * 1000) / 10 : null;

        const isFullMoon = Number.isFinite(phaseAngle) && Math.abs(phaseAngle - Math.PI) < 1e-3;
        const isNewMoon = Number.isFinite(phaseAngle) && (phaseAngle < 1e-3 || phaseAngle > 2 * Math.PI - 1e-3);
        const isWaxing = Number.isFinite(phaseAngle)
            ? (isFullMoon ? false : (isNewMoon ? true : phaseAngle < Math.PI))
            : false;

        const descriptors = describeLunarPhase(normalizedAge, illuminatedFraction, isWaxing, raw);

        return {
            timestamp: timestamp.toISOString(),
            age: normalizedAge,
            phaseAngle,
            illuminatedFraction,
            percentIlluminated,
            isWaxing,
            descriptors,
            times: {
                moonrise: formatTime(raw.moonrise ?? raw.moonRise),
                moonset: formatTime(raw.moonset ?? raw.moonSet),
                sunrise: formatTime(raw.sunrise ?? raw.sunRise),
                sunset: formatTime(raw.sunset ?? raw.sunSet)
            }
        };
    }

    function applyMoonState(state, options = {}) {
        if (!state) {
            updateText('moon-status', '달 위상 정보를 표시할 수 없습니다.');
            updateText('moon-phase-text', '달 위상 정보 없음');
            updateMoonGraphic(null);
            return;
        }

        const ageText = Number.isFinite(state.age) ? `${state.age.toFixed(1)} 일` : '-- 일';
        updateText('moon-age', ageText);

        if (state.percentIlluminated !== null) {
            const illuminationPercent = state.percentIlluminated.toFixed(1);
            updateText('illumination', `조도 ${illuminationPercent}%`);
        } else {
            updateText('illumination', '조도 정보를 확인할 수 없습니다');
        }

        updateText('moon-rise', `출: ${state.times.moonrise || '--:--'}`);
        updateText('moon-set', `몰: ${state.times.moonset || '--:--'}`);
        updateText('sunrise', `일출: ${state.times.sunrise || '--:--'}`);
        updateText('sunset', `일몰: ${state.times.sunset || '--:--'}`);

        const waxingText = state.isWaxing ? '왁싱 (상현으로 가는 길)' : '워닝 (하현으로 가는 길)';
        const phaseDisplay = state.descriptors.ko || '달 위상 정보 없음';
        updateText('moon-phase-text', `${phaseDisplay} · ${waxingText}`);

        updateMoonGraphic(state);

        const updatedDate = new Date(state.timestamp);
        updateText('moon-updated', Number.isNaN(updatedDate.getTime()) ? '시간 정보 없음' : formatKST(updatedDate));
        updateText('moon-status', options.fromCache ? '이전 저장값을 표시 중입니다. 최신 데이터를 확인하는 중...' : '달 위상 데이터가 업데이트되었습니다.');
        setRefreshState(false);
    }

    function handleMoonError(err, fallbackState) {
        console.error('Moon API error', err);
        if (fallbackState) {
            updateText('moon-status', '실시간 데이터를 불러오지 못했습니다. 마지막 저장값을 유지합니다. (서비스키 또는 CORS 설정을 확인하세요)');
        } else {
            updateText('moon-status', '달 위상 정보를 불러오지 못했습니다. (서비스키 또는 CORS 설정을 확인하세요)');
            updateMoonGraphic(null);
        }
        setRefreshState(false);
    }

    function getNodeText(parent, selector) {
        const node = parent?.querySelector(selector);
        return node ? node.textContent.trim() : '';
    }

    function normalizeLunarAge(age) {
        if (!Number.isFinite(age)) {
            return null;
        }
        let normalized = age % SYNODIC_MONTH;
        if (normalized < 0) {
            normalized += SYNODIC_MONTH;
        }
        return normalized;
    }

    function describeLunarPhase(age, fraction, isWaxing, raw) {
        const fallback = (raw?.lunphasename ?? raw?.phasename ?? '').trim();
        if (!Number.isFinite(age) || fraction === null) {
            return {
                ko: fallback || '달 위상 정보 없음',
                en: fallback || 'Unknown phase',
                stage: 'unknown'
            };
        }

        const progress = age / SYNODIC_MONTH;
        const phaseMap = {
            new: { ko: '신월', en: 'New Moon' },
            waxing_crescent: { ko: '초승달', en: 'Waxing Crescent' },
            first_quarter: { ko: '상현달', en: 'First Quarter' },
            waxing_gibbous: { ko: '상현 이후 달', en: 'Waxing Gibbous' },
            full: { ko: '보름달', en: 'Full Moon' },
            waning_gibbous: { ko: '하현 전 달', en: 'Waning Gibbous' },
            last_quarter: { ko: '하현달', en: 'Last Quarter' },
            waning_crescent: { ko: '그믐달', en: 'Waning Crescent' }
        };

        let key = 'new';
        if (progress < 0.03 || progress >= 0.97) {
            key = 'new';
        } else if (progress < 0.22) {
            key = 'waxing_crescent';
        } else if (progress < 0.28) {
            key = 'first_quarter';
        } else if (progress < 0.47) {
            key = 'waxing_gibbous';
        } else if (progress < 0.53) {
            key = 'full';
        } else if (progress < 0.72) {
            key = 'waning_gibbous';
        } else if (progress < 0.78) {
            key = 'last_quarter';
        } else {
            key = 'waning_crescent';
        }

        const descriptor = phaseMap[key] ?? phaseMap.new;
        return {
            ko: fallback || descriptor.ko,
            en: descriptor.en,
            stage: key,
            waxingLabel: isWaxing ? 'Waxing' : 'Waning'
        };
    }

    function updateMoonGraphic(state) {
        const container = document.getElementById('moon-graphic');
        if (!container) return;

        if (!state || state.illuminatedFraction === null) {
            container.innerHTML = '<span aria-hidden="true">🌘</span>';
            container.setAttribute('aria-label', '달 위상을 표시할 수 없습니다');
            return;
        }

        const svgMarkup = renderMoonSVG(state.illuminatedFraction, state.isWaxing, state.phaseAngle);
        container.innerHTML = svgMarkup;

        const illuminationLabel = state.percentIlluminated !== null ? `${state.percentIlluminated.toFixed(1)}% illuminated` : 'illumination unknown';
        const phaseLabel = state.descriptors?.en || 'Unknown phase';
        const waxingLabel = state.isWaxing ? 'Waxing' : 'Waning';
        container.setAttribute('aria-label', `Moon phase: ${phaseLabel} · ${illuminationLabel} · ${waxingLabel}`);
    }

    function renderMoonSVG(fraction, isWaxing, phaseAngle) {
        moonGraphicRenderCount += 1;
        const clipId = `moon-phase-clip-${moonGraphicRenderCount}`;
        const angle = Number.isFinite(phaseAngle) ? phaseAngle : 0;
        const direction = isWaxing ? 1 : -1;
        const normalizedAngle = isWaxing ? angle : (2 * Math.PI - angle);
        const pathData = buildClipPathFromAngle(normalizedAngle, direction);

        if (fraction !== null && fraction <= 0.005) {
            return [
                '<svg viewBox="0 0 100 100" role="presentation" aria-hidden="true">',
                '<circle cx="50" cy="50" r="48" fill="var(--moon-shadow)" />',
                '<circle cx="50" cy="50" r="48" fill="none" stroke="var(--moon-stroke)" stroke-width="1.5" />',
                '</svg>'
            ].join('');
        }

        if (fraction !== null && fraction >= 0.995) {
            return [
                '<svg viewBox="0 0 100 100" role="presentation" aria-hidden="true">',
                '<circle cx="50" cy="50" r="48" fill="var(--moon-lit)" />',
                '<circle cx="50" cy="50" r="48" fill="none" stroke="var(--moon-stroke)" stroke-width="1.5" />',
                '</svg>'
            ].join('');
        }

        return [
            `<svg viewBox="0 0 100 100" role="presentation" aria-hidden="true">`,
            '<defs>',
            `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">`,
            `<path d="${pathData}" />`,
            '</clipPath>',
            '</defs>',
            '<circle cx="50" cy="50" r="48" fill="var(--moon-shadow)" />',
            `<circle cx="50" cy="50" r="48" fill="var(--moon-lit)" clip-path="url(#${clipId})" />`,
            '<circle cx="50" cy="50" r="48" fill="none" stroke="var(--moon-stroke)" stroke-width="1.5" />',
            '</svg>'
        ].join('');
    }

    function renderMoonLessonIcons() {
        const nodes = document.querySelectorAll('[data-lesson-phase]');
        if (!nodes.length) {
            return;
        }
        nodes.forEach(node => {
            const phaseKey = node.getAttribute('data-lesson-phase');
            const lesson = LESSON_PHASE_DATA[phaseKey];
            if (!lesson) {
                return;
            }
            const angle = (2 * Math.PI * lesson.age) / SYNODIC_MONTH;
            const fraction = clamp((1 - Math.cos(angle)) / 2, 0, 1) ?? 0;
            const markup = renderMoonSVG(fraction, lesson.isWaxing, angle);
            node.innerHTML = markup;
        });
    }

    function buildClipPathFromAngle(angle, direction) {
        const radius = 48;
        const cx = 50;
        const cy = 50;
        const steps = 120;
        const cosPhase = Math.cos(angle);

        const outerPoints = [];
        const innerPoints = [];
        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const y = -radius + 2 * radius * t;
            const outerX = Math.sqrt(Math.max(0, radius * radius - y * y));
            const terminatorX = clamp(cosPhase * outerX, -outerX, outerX);

            outerPoints.push({
                x: cx + direction * outerX,
                y: cy + y
            });
            innerPoints.push({
                x: cx + direction * terminatorX,
                y: cy + y
            });
        }

        const points = outerPoints.concat(innerPoints.reverse());
        if (!points.length) {
            return '';
        }

        let path = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
        for (let i = 1; i < points.length; i += 1) {
            path += `L${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
        }
        path += 'Z';
        return path;
    }

    function formatDateKey(date) {
        if (!(date instanceof Date)) {
            return '';
        }
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function readMoonCache(dateKey) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        try {
            const raw = window.localStorage.getItem(MOON_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed?.dateKey === dateKey && parsed?.state) {
                return parsed.state;
            }
        } catch (error) {
            console.warn('Moon cache read failed', error);
        }
        return null;
    }

    function saveMoonCache(dateKey, state) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const payload = {
                dateKey,
                state
            };
            window.localStorage.setItem(MOON_CACHE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Moon cache save failed', error);
        }
    }

    function calculateSensibleTemperature(data) {
        const temperature = parseFloat(data.T1H);
        const windSpeed = parseFloat(data.WSD);
        if (!Number.isFinite(temperature) || !Number.isFinite(windSpeed)) {
            return null;
        }
        if (temperature <= 26.7 && windSpeed > 4.8) {
            const windChill = 13.12 + 0.6215 * temperature - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temperature * Math.pow(windSpeed, 0.16);
            return windChill.toFixed(1);
        }
        return temperature.toFixed(1);
    }

    function describePrecipitationType(code) {
        const mapping = {
            '0': '강수 없음',
            '1': '비',
            '2': '비/눈',
            '3': '눈',
            '4': '소나기',
            '5': '빗방울',
            '6': '빗방울눈날림',
            '7': '눈날림'
        };
        return mapping[String(code)] || '강수형태 정보 없음';
    }

    function describeSkyCondition(code, precipText) {
        const mapping = {
            '1': '맑음',
            '2': '구름 조금',
            '3': '구름 많음',
            '4': '흐림'
        };
        const base = mapping[String(code)] || '하늘 상태 정보 없음';
        if (precipText && precipText !== '강수 없음') {
            return `${base} · ${precipText}`;
        }
        return base;
    }

    function describeWindDirection(value) {
        const degrees = parseFloat(value);
        if (!Number.isFinite(degrees)) {
            return '풍향 정보 없음';
        }
        const directions = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        const index = Math.round(((degrees % 360) / 22.5)) % 16;
        return `${directions[index]} (${degrees.toFixed(0)}°)`;
    }

    function formatTime(value) {
        if (!value) {
            return '--:--';
        }
        const numeric = String(value).padStart(4, '0');
        if (numeric.length !== 4) {
            return numeric;
        }
        return `${numeric.slice(0, 2)}:${numeric.slice(2)}`;
    }

    function formatNumber(value, fractionDigits = 0) {
        const number = parseFloat(value);
        if (!Number.isFinite(number)) {
            return null;
        }
        return number.toFixed(fractionDigits);
    }

    function clamp(value, min, max) {
        if (!Number.isFinite(value)) {
            return null;
        }
        if (Number.isFinite(min) && value < min) {
            return min;
        }
        if (Number.isFinite(max) && value > max) {
            return max;
        }
        return value;
    }

    function formatKST(date) {
        if (!(date instanceof Date)) {
            return '시간 정보 없음';
        }
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min} (KST)`;
    }

    function getLatestBaseTimestamp() {
        const now = getKSTDate();
        if (now.getMinutes() < 40) {
            now.setHours(now.getHours() - 1);
        }
        now.setMinutes(0, 0, 0);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        return {
            baseDate: `${y}${m}${d}`,
            baseTime: `${h}00`,
            kstDate: now
        };
    }

    function getKSTDate() {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utc + 9 * 60 * 60 * 1000);
    }

    function assertOk(response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response;
    }

    function updateText(id, text) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = text;
    }

    function setRefreshState(isLoading) {
        const button = document.getElementById('refresh-btn');
        if (!button) return;
        if (isLoading) {
            button.disabled = true;
            button.textContent = '불러오는 중...';
        } else {
            button.disabled = false;
            button.textContent = '새로고침';
        }
    }
})();
