// moon.js - 날씨와 달 위상 정보를 불러와 moon.html에 표시하는 스크립트
(function() {
    const WEATHER_ENDPOINT = 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst';
    const WEATHER_API_KEY = 'A-QSlscIRIWkEpbHCGSFKw';
    const MOON_ENDPOINT = 'http://apis.data.go.kr/B090041/openapi/service/LunPhInfoService/getLunPhInfo';
    const MOON_API_KEY = 'A-QSlscIRIWkEpbHCGSFKw';

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
            pageNo: '1',
            numOfRows: '1000',
            dataType: 'XML',
            base_date: baseDate,
            base_time: baseTime,
            nx: String(GRID.nx),
            ny: String(GRID.ny),
            authKey: WEATHER_API_KEY
        });
        const url = `${WEATHER_ENDPOINT}?${params.toString()}`;
        updateText('weather-status', '기상청 API에 요청 중입니다...');

        fetch(url)
            .then(assertOk)
            .then(res => res.text())
            .then(parseWeatherResponse)
            .then(data => applyWeatherData(data, kstDate))
            .catch(err => handleWeatherError(err));
    }

    function parseWeatherResponse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const items = Array.from(doc.querySelectorAll('item'));
        if (!items.length) {
            throw new Error('기상청 응답에 데이터가 없습니다.');
        }
        const data = {};
        items.forEach(item => {
            const category = textContent(item, 'category');
            const value = textContent(item, 'obsrValue');
            if (category) {
                data[category.trim()] = value;
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
        const year = kstNow.getFullYear();
        const month = String(kstNow.getMonth() + 1).padStart(2, '0');
        const day = String(kstNow.getDate()).padStart(2, '0');

        const params = new URLSearchParams({
            solYear: String(year),
            solMonth: month,
            solDay: day,
            serviceKey: MOON_API_KEY,
            _type: 'json'
        });
        const url = `${MOON_ENDPOINT}?${params.toString()}`;
        updateText('moon-status', '달 위상 API에 요청 중입니다...');

        fetch(url)
            .then(assertOk)
            .then(res => res.json())
            .then(parseMoonResponse)
            .then(data => applyMoonData(data, kstNow))
            .catch(err => handleMoonError(err));
    }

    function parseMoonResponse(json) {
        const body = json?.response?.body;
        const items = body?.items?.item;
        if (!items) {
            throw new Error('달 위상 응답에 데이터가 없습니다.');
        }
        return Array.isArray(items) ? items[0] : items;
    }

    function applyMoonData(data, timestamp) {
        const age = formatNumber(data?.lunAge || data?.lunAgeDay, 1);
        updateText('moon-age', age !== null ? `${age} 일` : '-- 일');

        const illumination = formatNumber(data?.iradiance || data?.sunMoonIllumination, 1);
        updateText('illumination', illumination !== null ? `조도 ${illumination}%` : '조도 정보를 확인할 수 없습니다');

        updateText('moon-rise', `출: ${formatTime(data?.moonrise)}`);
        updateText('moon-set', `몰: ${formatTime(data?.moonset)}`);

        updateText('sunrise', `일출: ${formatTime(data?.sunrise)}`);
        updateText('sunset', `일몰: ${formatTime(data?.sunset)}`);

        const phaseText = data?.lunPhaseName || data?.phaseName || derivePhaseName(age);
        updateText('moon-phase-text', phaseText || '달 위상 정보 없음');
        updateMoonEmoji(phaseText, age);

        updateText('moon-status', '달 위상 데이터가 업데이트되었습니다.');
        updateText('moon-updated', formatKST(timestamp));
        setRefreshState(false);
    }

    function handleMoonError(err) {
        console.error('Moon API error', err);
        updateText('moon-status', '달 위상 정보를 불러오지 못했습니다. (서비스키 또는 CORS 설정을 확인하세요)');
        setRefreshState(false);
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

    function derivePhaseName(age) {
        if (!Number.isFinite(age)) {
            return null;
        }
        if (age < 1) return '신월';
        if (age < 6.382646) return '삭 이후 초승달';
        if (age < 8.382646) return '상현 전 초승달';
        if (age < 12.765293) return '상현달';
        if (age < 16.765293) return '상현 이후 달';
        if (age < 18.765293) return '보름달';
        if (age < 23.14794) return '하현 전 보름달';
        if (age < 26.14794) return '하현달';
        if (age < 29) return '그믐달';
        return '신월';
    }

    function updateMoonEmoji(phaseText, age) {
        const element = document.getElementById('moon-emoji');
        if (!element) return;
        let emoji = '🌘';
        if (phaseText) {
            if (phaseText.includes('신월')) emoji = '🌑';
            else if (phaseText.includes('초승')) emoji = '🌒';
            else if (phaseText.includes('상현')) emoji = '🌓';
            else if (phaseText.includes('보름')) emoji = '🌕';
            else if (phaseText.includes('하현')) emoji = '🌗';
            else if (phaseText.includes('그믐')) emoji = '🌘';
        } else if (Number.isFinite(age)) {
            if (age < 1) emoji = '🌑';
            else if (age < 6) emoji = '🌒';
            else if (age < 9) emoji = '🌓';
            else if (age < 15) emoji = '🌔';
            else if (age < 17) emoji = '🌕';
            else if (age < 22) emoji = '🌖';
            else if (age < 26) emoji = '🌗';
            else emoji = '🌘';
        }
        element.textContent = emoji;
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

    function textContent(parent, selector) {
        const value = parent.querySelector(selector);
        return value ? value.textContent : '';
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
