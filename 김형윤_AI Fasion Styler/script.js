// 옷장 데이터 저장소
let wardrobe = [];

// 일정 데이터 저장소
let schedule = [];

// 추천된 옷 기록 (중복 방지용) - 이제는 이번주 미사용 옷 우선 추천용
let recommendedItems = new Set();

// 이번주 사용 기록 (옷 추천 우선순위용)
let thisWeekUsedItems = new Set();

// 이번주 시작 날짜 (주가 바뀌면 기록 초기화)
let currentWeekStart = null;

// AI 추천 시스템 가중치 설정 (조정 가능, 머신러닝 확장 가능)
const RECOMMENDATION_WEIGHTS = {
    // 태그 매칭 가중치
    tagExactMatch: 100,        // 태그 정확 일치
    tagPartialMatch: 50,       // 태그 부분 일치
    tagCountMultiplier: 5,     // 태그 개수당 점수
    
    // 날씨 기반 가중치
    weatherScore: {
        max: 80,               // 최대 날씨 점수
        normal: 50,            // 일반 날씨 점수
        humidity: 20,          // 습도 보너스
        coldThreshold: 9,      // 추운 날씨 기준 (°C 이하)
        coldBonus: 50,         // 추운 날씨 보너스 (패딩/두꺼운 외투)
        rainBonus: 40,         // 비 올 때 방수 재질 보너스
        snowBonus: 50          // 눈 올 때 보너스
    },
    
    // 활동 유형 가중치
    activityType: {
        formalBonus: 60,       // 공식 자리 정장/셔츠 보너스
        formalCasualPenalty: -30, // 공식 자리 캐주얼 의류 감점
        informalBonus: 20      // 비공식 자리 보너스
    },
    
    // 장소 가중치
    location: {
        outdoorBonus: 15,      // 실외 활동 보너스
        indoorBonus: 10        // 실내 활동 보너스
    },
    
    // 시간대 가중치
    timeOfDay: {
        dayBonus: 5,           // 낮 활동 보너스
        nightBonus: 10         // 밤 활동 보너스
    },
    
    // 색상 조화 가중치
    colorHarmony: {
        analogous: 30,         // 유사 색상
        complementary: 25,     // 보색
        triadic: 20,           // 삼원색 조화
        monochromatic: 25,     // 단색 조화
        neutral: 15,           // 중성색 조화
        desaturated: 10,       // 무채색 조화
        tooSimilar: -5         // 너무 비슷한 색상 (감점)
    },
    
    // 부적합한 조합 가중치
    
    // 이번주 미사용 옷 우선 추천 가중치
    unusedThisWeekBonus: 40,  // 이번주에 입지 않은 옷 보너스 점수
    incompatibleCombinations: {
        penalty: -200,         // 부적합한 조합 감점 (추천 제외 수준)
        excludeThreshold: -100 // 이 점수 이하면 추천 제외
    },
    
    // 상태 가중치
    status: {
        ready: 10,             // 사용 가능
        clean: 5,              // 깨끗함
        washing: -1000         // 빨래 중 (제외)
    },
    
    // 기타 가중치
    randomness: 10,            // 랜덤 요소 (다양성)
    alreadyUsed: -500         // 이미 추천된 옷 (감점)
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadData();
});

// 앱 초기화
function initializeApp() {
    // 코디 추천 버튼 이벤트
    document.getElementById('recommend-outfits').addEventListener('click', recommendOutfits);
    
    // 일정 입력 이벤트
    document.querySelectorAll('.day-event').forEach(input => {
        input.addEventListener('change', updateSchedule);
        input.addEventListener('blur', updateSchedule);
    });
    
    // 필터 이벤트
    document.getElementById('filter-category').addEventListener('change', updateWardrobeDisplay);
    document.getElementById('filter-season').addEventListener('change', updateWardrobeDisplay);
    
    // 기온/습도/날씨/활동유형/장소/시간대 입력 필드 이벤트
    document.querySelectorAll('.day-temperature, .day-humidity, .day-weather, .day-activity-type, .day-location, .day-time').forEach(input => {
        input.addEventListener('change', updateSchedule);
        input.addEventListener('blur', updateSchedule);
    });
}

// 이번주 시작 날짜 계산 (월요일 기준)
function getWeekStartDate(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
    return new Date(d.setDate(diff));
}

// 이번주 사용 기록 초기화 (주가 바뀌면)
function checkAndResetWeekUsage() {
    const today = new Date();
    const weekStart = getWeekStartDate(today);
    const weekStartStr = weekStart.toDateString();
    
    // 주가 바뀌었으면 기록 초기화
    if (!currentWeekStart || currentWeekStart !== weekStartStr) {
        thisWeekUsedItems.clear();
        currentWeekStart = weekStartStr;
        // localStorage에 저장
        localStorage.setItem('thisWeekUsedItems', JSON.stringify(Array.from(thisWeekUsedItems)));
        localStorage.setItem('currentWeekStart', currentWeekStart);
    }
}

// localStorage에서 데이터 로드
function loadData() {
    // 이번주 시작 날짜 확인 및 기록 초기화
    checkAndResetWeekUsage();
    
    // 이번주 사용 기록 로드
    const storedWeekUsed = localStorage.getItem('thisWeekUsedItems');
    if (storedWeekUsed) {
        thisWeekUsedItems = new Set(JSON.parse(storedWeekUsed));
    }
    
    // 이번주 시작 날짜 로드
    const storedWeekStart = localStorage.getItem('currentWeekStart');
    if (storedWeekStart) {
        currentWeekStart = storedWeekStart;
    }
    
    // 옷장 데이터 로드
    const storedWardrobe = localStorage.getItem('wardrobe');
    if (storedWardrobe) {
        wardrobe = JSON.parse(storedWardrobe);
        // 기존 데이터에 id와 status 필드가 없으면 추가
        wardrobe.forEach((item, index) => {
            if (!item.id) {
                item.id = 'item_' + Date.now() + '_' + index;
            }
            if (!item.status) {
                item.status = 'ready';
            }
        });
        saveData(); // 업데이트된 데이터 저장
    } else {
        // 저장된 데이터가 없으면 예시 데이터 로드
        loadExampleData();
    }
    
    // 일정 데이터 로드
    const storedSchedule = localStorage.getItem('schedule');
    if (storedSchedule) {
        schedule = JSON.parse(storedSchedule);
        // 일정 입력 필드에 반영
        schedule.forEach(item => {
            const dayCard = document.querySelector(`.day-card[data-day="${item.day}"]`);
            if (dayCard) {
                const eventInput = dayCard.querySelector('.day-event');
                const tempInput = dayCard.querySelector('.day-temperature');
                const humidityInput = dayCard.querySelector('.day-humidity');
                const weatherInput = dayCard.querySelector('.day-weather');
                const activityTypeInput = dayCard.querySelector('.day-activity-type');
                const locationInput = dayCard.querySelector('.day-location');
                const timeInput = dayCard.querySelector('.day-time');
                
                if (eventInput) eventInput.value = item.event || '';
                if (tempInput && item.temperature !== undefined && item.temperature !== null && item.temperature !== '') {
                    tempInput.value = item.temperature;
                }
                if (humidityInput && item.humidity !== undefined && item.humidity !== null && item.humidity !== '') {
                    humidityInput.value = item.humidity;
                }
                if (weatherInput) weatherInput.value = item.weather || '맑음';
                if (activityTypeInput) activityTypeInput.value = item.activityType || '';
                if (locationInput) locationInput.value = item.location || '실외';
                if (timeInput) timeInput.value = item.timeOfDay || '낮';
            }
        });
    }
    
    updateWardrobeDisplay();
}

// localStorage에 데이터 저장
function saveData() {
    localStorage.setItem('wardrobe', JSON.stringify(wardrobe));
    localStorage.setItem('schedule', JSON.stringify(schedule));
}

// 예시 데이터 로드 (처음 사용자용)
function loadExampleData() {
    const exampleClothes = [
        { 
            name: "흰 셔츠", 
            category: "상의", 
            season: "봄",
            tags: ["회의", "포멀"],
            image: null,
            status: 'ready',
            id: 'example1'
        },
        { 
            name: "슬랙스", 
            category: "하의", 
            season: "봄",
            tags: ["회의", "포멀"],
            image: null,
            status: 'ready',
            id: 'example2'
        },
        { 
            name: "운동복 상의", 
            category: "상의", 
            season: "사계절",
            tags: ["운동"],
            image: null,
            status: 'ready',
            id: 'example3'
        },
        { 
            name: "운동복 하의", 
            category: "하의", 
            season: "사계절",
            tags: ["운동"],
            image: null,
            status: 'ready',
            id: 'example4'
        },
        { 
            name: "청바지", 
            category: "하의", 
            season: "가을",
            tags: ["캐주얼"],
            image: null,
            status: 'ready',
            id: 'example5'
        },
        { 
            name: "로퍼", 
            category: "신발", 
            season: "사계절",
            tags: ["회의", "포멀"],
            image: null,
            status: 'ready',
            id: 'example6'
        },
        { 
            name: "운동화", 
            category: "신발", 
            season: "사계절",
            tags: ["운동", "캐주얼"],
            image: null,
            status: 'ready',
            id: 'example7'
        },
        { 
            name: "티셔츠", 
            category: "상의", 
            season: "여름",
            tags: ["캐주얼"],
            image: null,
            status: 'ready',
            id: 'example8'
        },
        { 
            name: "원피스", 
            category: "상의", 
            season: "여름",
            tags: ["데이트", "캐주얼"],
            image: null,
            status: 'ready',
            id: 'example9'
        },
        { 
            name: "구두", 
            category: "신발", 
            season: "사계절",
            tags: ["데이트", "포멀"],
            image: null,
            status: 'ready',
            id: 'example10'
        }
    ];
    
    wardrobe = exampleClothes;
    saveData();
}

// 옷장 표시 업데이트
function updateWardrobeDisplay() {
    const wardrobeList = document.getElementById('wardrobe-list');
    const filterCategory = document.getElementById('filter-category').value;
    const filterSeason = document.getElementById('filter-season').value;
    
    // 필터링
    let filteredWardrobe = wardrobe;
    if (filterCategory) {
        filteredWardrobe = filteredWardrobe.filter(item => item.category === filterCategory);
    }
    if (filterSeason) {
        filteredWardrobe = filteredWardrobe.filter(item => item.season === filterSeason);
    }
    
    if (filteredWardrobe.length === 0) {
        wardrobeList.innerHTML = '<p class="empty-message">조건에 맞는 옷이 없습니다.</p>';
        return;
    }
    
    wardrobeList.innerHTML = filteredWardrobe.map((clothing, index) => {
        const originalIndex = wardrobe.indexOf(clothing);
        const status = clothing.status || 'ready';
        const statusClass = status === 'washing' ? 'status-washing' : status === 'clean' ? 'status-clean' : 'status-ready';
        const statusText = status === 'washing' ? '빨래 중' : status === 'clean' ? '깨끗함' : '사용 가능';
        const statusIcon = status === 'washing' ? '🧺' : status === 'clean' ? '✨' : '✅';
        
        return `
            <div class="clothing-item ${statusClass}">
                <div class="clothing-image-container">
                    ${clothing.image 
                        ? `<img src="${clothing.image}" alt="${clothing.name}" class="clothing-image">`
                        : `<div class="no-image-placeholder">👔</div>`
                    }
                    ${status === 'washing' ? '<div class="washing-overlay">빨래 중</div>' : ''}
                </div>
                <div class="clothing-info">
                    <strong>${clothing.name}</strong>
                    <div class="clothing-meta">
                        <span class="category-badge">${clothing.category}</span>
                        <span class="season-badge">${clothing.season}</span>
                        <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
                    </div>
                    <div class="tags">
                        ${clothing.tags.map(tag => `<span>${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="clothing-actions">
                    <button class="laundry-btn" onclick="toggleLaundryStatus(${originalIndex})" title="빨래 상태 변경">
                        ${status === 'washing' ? '빨래 완료' : status === 'clean' ? '사용 완료' : '빨래 시작'}
                    </button>
                    <button class="delete-clothing" onclick="deleteClothing(${originalIndex})">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

// 빨래 상태 변경 함수
function toggleLaundryStatus(index) {
    const clothing = wardrobe[index];
    if (!clothing.status || clothing.status === 'ready') {
        clothing.status = 'washing';
    } else if (clothing.status === 'washing') {
        clothing.status = 'clean';
    } else if (clothing.status === 'clean') {
        clothing.status = 'ready';
    }
    saveData();
    updateWardrobeDisplay();
}

// 옷 삭제 함수
function deleteClothing(index) {
    if (confirm('이 옷을 옷장에서 삭제하시겠습니까?')) {
        wardrobe.splice(index, 1);
        saveData();
        updateWardrobeDisplay();
    }
}

// 일정 업데이트 함수
function updateSchedule() {
    schedule = [];
    document.querySelectorAll('.day-card').forEach(card => {
        const day = card.getAttribute('data-day');
        const eventInput = card.querySelector('.day-event');
        const tempInput = card.querySelector('.day-temperature');
        const humidityInput = card.querySelector('.day-humidity');
        const weatherInput = card.querySelector('.day-weather');
        const activityTypeInput = card.querySelector('.day-activity-type');
        const locationInput = card.querySelector('.day-location');
        const timeInput = card.querySelector('.day-time');
        
        const event = eventInput ? eventInput.value.trim() : '';
        const temp = tempInput ? (tempInput.value.trim() !== '' ? parseFloat(tempInput.value) : null) : null;
        const humidity = humidityInput ? (humidityInput.value.trim() !== '' ? parseFloat(humidityInput.value) : null) : null;
        const weather = weatherInput ? weatherInput.value : '맑음';
        const activityType = activityTypeInput ? activityTypeInput.value : '';
        const location = locationInput ? locationInput.value : '실외';
        const timeOfDay = timeInput ? timeInput.value : '낮';
        
        // 일정이 있거나 기온/습도가 입력된 경우에만 저장
        if (event || (temp !== null && !isNaN(temp)) || (humidity !== null && !isNaN(humidity))) {
            schedule.push({ 
                day: day, 
                event: event,
                temperature: temp !== null && !isNaN(temp) ? temp : null,
                humidity: humidity !== null && !isNaN(humidity) ? humidity : null,
                weather: weather,
                activityType: activityType,
                location: location,
                timeOfDay: timeOfDay
            });
        }
    });
    saveData();
}

// 코디 추천 함수
function recommendOutfits() {
    updateSchedule();
    
    if (schedule.length === 0) {
        alert('일정을 입력해주세요.');
        return;
    }
    
    if (wardrobe.length === 0) {
        alert('옷장에 옷이 없습니다. 옷을 등록해주세요.');
        return;
    }
    
    // 추천된 옷 기록 초기화 (새로운 추천 시)
    recommendedItems.clear();
    
    // 같은 이벤트 타입별로 그룹화하여 중복 방지
    const eventGroups = {};
    schedule.forEach(item => {
        if (!eventGroups[item.event]) {
            eventGroups[item.event] = [];
        }
        eventGroups[item.event].push(item);
    });
    
    // 각 그룹별로 다른 옷 추천
    const allRecommendedItems = new Set();
    
    const recommendations = schedule.map((item, index) => {
        const sameEventItems = eventGroups[item.event].slice(0, eventGroups[item.event].indexOf(item) + 1);
        // 요일별 정보 가져오기 (기본값 설정)
        const temperature = item.temperature !== null && !isNaN(item.temperature) ? item.temperature : 20;
        const humidity = item.humidity !== null && !isNaN(item.humidity) ? item.humidity : 60;
        const weather = item.weather || '맑음';
        const activityType = item.activityType || '';
        const location = item.location || '실외';
        const timeOfDay = item.timeOfDay || '낮';
        
        const outfit = findMatchingOutfit(item.event, temperature, humidity, new Set(), weather, activityType, location, timeOfDay);
        
        // 추천된 옷을 이번주 사용 기록에 추가 (모든 옷 중복 허용)
        if (outfit.outer) thisWeekUsedItems.add(outfit.outer.id || outfit.outer.name);
        if (outfit.top) thisWeekUsedItems.add(outfit.top.id || outfit.top.name);
        if (outfit.bottom) thisWeekUsedItems.add(outfit.bottom.id || outfit.bottom.name);
        if (outfit.shoes) thisWeekUsedItems.add(outfit.shoes.id || outfit.shoes.name);
        
        // localStorage에 저장
        localStorage.setItem('thisWeekUsedItems', JSON.stringify(Array.from(thisWeekUsedItems)));
        localStorage.setItem('currentWeekStart', currentWeekStart);
        
        return {
            day: item.day,
            event: item.event,
            temperature: temperature,
            humidity: humidity,
            outfit: outfit
        };
    });
    
    displayRecommendations(recommendations);
}

// 기온/습도/날씨 기반 옷 적합성 점수 계산 (모듈화, 확장 가능)
function calculateWeatherScore(clothing, temperature, humidity, weather = '맑음', otherClothesInOutfit = []) {
    let score = 0;
    const weights = RECOMMENDATION_WEIGHTS.weatherScore;
    
    // 기온 기반 점수 계산
   // [script.js]
// ...
    // 기온 기반 점수 계산
    if (clothing.category === '아우터') {
        
        // 9°C 이하일 경우 아우터 점수를 매우 높게 설정 (무조건 추천되도록)
        if (temperature <= weights.coldThreshold) { // 9°C 이하
            // 모든 아우터에 매우 높은 기본 점수 부여 (300점 이상으로 설정하여 최우선 추천)
            score += 300; // 매우 높은 기본 점수
            
            // 두꺼운 아우터(패딩, 코트 등)인지 확인
            const isThickOuter = clothing.name.includes('패딩') || clothing.name.includes('두꺼운') || 
                                 clothing.name.includes('코트');
            
            // 두꺼운 옷이거나 패딩/코트일 때 계절 우선순위 적용
            // 겨울옷 우선 -> 가을옷 -> 봄옷 -> 여름옷 순으로 점수 부여
            if (isThickOuter) {
                // 패딩/코트/두꺼운 옷일 때 계절 우선순위
                if (clothing.season === '겨울') {
                    score += 100; // 겨울옷 우선 (총 400점)
                } else if (clothing.season === '가을') {
                    score += 70; // 가을옷 (총 370점)
                } else if (clothing.season === '봄') {
                    score += 50; // 봄옷 (총 350점)
                } else if (clothing.season === '여름') {
                    score += 30; // 여름옷 (총 330점)
                } else {
                    score += 60; // 사계절 등 (총 360점)
                }
            } else {
                // 일반 아우터도 계절 우선순위 적용
                if (clothing.season === '겨울') {
                    score += 100; // 겨울옷 우선 (총 400점)
                } else if (clothing.season === '가을') {
                    score += 70; // 가을옷 (총 370점)
                } else if (clothing.season === '봄') {
                    score += 50; // 봄옷 (총 350점)
                } else if (clothing.season === '여름') {
                    score += 30; // 여름옷 (총 330점)
                } else {
                    score += 60; // 사계절 등 (총 360점)
                }
            }
        }
        
        // 2. 쌀쌀한 날씨 (9°C 초과 ~ 15°C 이하)
        else if (temperature <= 15) {
            if (clothing.name.includes('자켓') || clothing.name.includes('가디건') || 
                clothing.name.includes('후드') || clothing.season === '가을' || clothing.season === '봄') {
                score += 60;
            }
        }
        
        // 3. 선선한 날씨 (15°C 초과 ~ 22°C 이하)
        else if (temperature <= 22) {
            if (clothing.name.includes('가디건') || clothing.name.includes('블레이저') || 
                clothing.season === '봄' || clothing.season === '가을') {
                score += 50;
            } else if (clothing.season === '사계절') {
                score += 40;
            }
        }
        
        // 4. 따뜻한 날씨 (22°C 초과 ~ 30°C) - 얇은 아우터만 선택적 추천
        else if (temperature <= 30) {
            // 20~30°C일 때는 아우터 추천을 최소화 (여름 옷 추천 우선)
            if (clothing.name.includes('가디건') || clothing.name.includes('린넨') || 
                clothing.season === '봄' || clothing.season === '여름') {
                score += 10; // 점수 낮춤 (선택적 추천)
            } else {
                score -= 50; // 여름에 부적합한 아우터는 감점
            }
        }
        // 5. 더운 날씨 (30°C 초과) - 아우터 추천 안 함
        else {
            score -= 100; // 매우 더운 날씨에서는 아우터 추천 안 함
        }
    }
    
    // 상의/하의 기온 적합성 점수 계산 (기온 영향 완화 - 모든 기온에서 기본 점수 보장)
    if (clothing.category === '상의' || clothing.category === '하의') {
        // 상의/하의는 기온과 관계없이 항상 기본 점수 부여 (데이트 등에서 추천되도록)
        // 기온에 따라 가산점을 주되, 모든 기온에서 최소한의 점수는 보장
        
        // 아우터가 두꺼운 옷(패딩/코트)일 때 상의/하의도 계절 우선순위 적용
        const hasThickOuter = otherClothesInOutfit && otherClothesInOutfit.length > 0 && 
            otherClothesInOutfit.some(item => 
                item && item.category === '아우터' && 
                (item.name.includes('패딩') || item.name.includes('두꺼운') || item.name.includes('코트'))
            );
        
        // 두꺼운 아우터가 있을 때 계절 우선순위 반영
        if (hasThickOuter) {
            // 겨울옷 우선 -> 가을옷 -> 봄옷 -> 여름옷 순으로 점수 부여
            if (clothing.season === '겨울') {
                score += 40; // 겨울옷 우선 (두꺼운 아우터와 잘 어울림)
            } else if (clothing.season === '가을') {
                score += 30; // 가을옷
            } else if (clothing.season === '봄') {
                score += 20; // 봄옷
            } else if (clothing.season === '여름') {
                score += 10; // 여름옷
            } else {
                score += 25; // 사계절 등
            }
        }
        
        // 매우 추운 날씨 (-5도 이하)
        if (temperature <= -5) {
            if (clothing.name.includes('두꺼운') || clothing.name.includes('니트') || 
                clothing.season === '겨울') {
                score += 60;
            } else if (clothing.season === '가을') {
                score += 40; // 겨울옷 없으면 가을옷 점수
            } else if (clothing.season === '봄') {
                score += 30; // 그 다음 봄옷
            } else if (clothing.season === '여름') {
                score += 20; // 마지막 여름옷
            } else {
                score += 25; // 기본 점수 (기온 영향 완화)
            }
        }
        // 추운 날씨 (-5도 ~ 10도)
        else if (temperature <= 10) {
            if (clothing.name.includes('니트') || clothing.name.includes('긴팔') || 
                clothing.season === '겨울') {
                score += 50;
            } else if (clothing.season === '가을') {
                score += 40; // 가을옷 점수
            } else if (clothing.season === '봄') {
                score += 35; // 봄옷 점수
            } else if (clothing.season === '여름') {
                score += 25; // 여름옷 점수
            } else {
                score += 30; // 기본 점수
            }
        }
        // 선선한 날씨 (10도 ~ 20도)
        else if (temperature <= 20) {
            if (clothing.name.includes('긴팔') || clothing.name.includes('셔츠') || 
                clothing.season === '봄' || clothing.season === '가을') {
                score += 50;
            } else if (clothing.season === '사계절') {
                score += 40;
            } else if (clothing.season === '겨울') {
                score += 30; // 겨울옷도 점수 부여
            } else if (clothing.season === '여름') {
                score += 30; // 여름옷도 점수 부여
            } else {
                score += 35; // 기본 점수
            }
        }
        // 따뜻한 날씨 (20도 ~ 25도)
        else if (temperature <= 25) {
            if (clothing.name.includes('반팔') || clothing.name.includes('티셔츠') || 
                clothing.season === '봄' || clothing.season === '여름') {
                score += 50;
            } else if (clothing.season === '사계절') {
                score += 40;
            } else {
                // 다른 계절 옷도 점수 부여 (데이트 등에서 추천되도록)
                score += 35; // 기본 점수 완화
            }
        }
        // 더운 날씨 (25도 이상)
        else {
            if (clothing.name.includes('반팔') || clothing.name.includes('민소매') || 
                clothing.name.includes('린넨') || clothing.season === '여름') {
                score += 60;
            } else if (clothing.season === '봄') {
                score += 40;
            } else if (clothing.season === '가을') {
                score += 30;
            } else {
                // 다른 계절 옷도 기본 점수 부여 (데이트 등에서 추천되도록)
                score += 35; // 기본 점수 완화
            }
        }
    }
    
    // 습도 기반 점수 (높은 습도일 때 얇은 소재 선호)
    if (humidity >= 70) {
        if (clothing.name.includes('린넨') || clothing.name.includes('면') || 
            clothing.name.includes('시원한')) {
            score += weights.humidity;
        }
        if (clothing.name.includes('니트') || clothing.name.includes('두꺼운')) {
            score -= 15;
        }
    }
    
    // 날씨 기반 점수 계산
    // 비가 올 때 방수 재질 의류 점수 높게
    if (weather === '비') {
        if (clothing.name.includes('방수') || clothing.name.includes('우비') || 
            clothing.name.includes('레인코트') || clothing.name.includes('나일론') ||
            clothing.name.includes('GORE-TEX') || clothing.name.includes('고어텍스')) {
            score += weights.rainBonus;
        }
        // 비 올 때 천 소재 감점
        if (clothing.name.includes('면') || clothing.name.includes('린넨') || 
            clothing.name.includes('코튼') && !clothing.name.includes('방수')) {
            score -= 10;
        }
    }
    
    // 눈이 올 때
    if (weather === '눈') {
        if (clothing.name.includes('패딩') || clothing.name.includes('두꺼운') || 
            clothing.name.includes('방한') || clothing.season === '겨울') {
            score += weights.snowBonus;
        }
    }
    
    return score;
}

// 활동 유형 기반 점수 계산 (모듈화, 확장 가능)
function calculateActivityTypeScore(clothing, activityType) {
    if (!activityType) return 0;
    
    let score = 0;
    const weights = RECOMMENDATION_WEIGHTS.activityType;
    
    // 공식적인 자리(formal)에서 정장, 셔츠 등의 점수 높게, 캐주얼 의류 점수 낮추기
    if (activityType === '공식') {
        if (clothing.name.includes('정장') || clothing.name.includes('슈트') ||
            clothing.name.includes('셔츠') || clothing.name.includes('블레이저') ||
            clothing.name.includes('넥타이') || clothing.name.includes('드레스셔츠') ||
            clothing.tags.some(tag => tag.includes('포멀') || tag.includes('회의') || tag.includes('비즈니스'))) {
            score += weights.formalBonus;
        }
        // 캐주얼 의류 감점
        if (clothing.name.includes('티셔츠') || clothing.name.includes('후드') ||
            clothing.name.includes('운동복') || clothing.name.includes('청바지') ||
            clothing.tags.some(tag => tag.includes('캐주얼') || tag.includes('운동'))) {
            score += weights.formalCasualPenalty;
        }
    } else if (activityType === '비공식') {
        // 비공식 자리에서는 다양한 옷 허용
        score += weights.informalBonus;
    }
    
    return score;
}

// 장소 기반 점수 계산
function calculateLocationScore(clothing, location) {
    if (!location) return 0;
    
    let score = 0;
    const weights = RECOMMENDATION_WEIGHTS.location;
    
    if (location === '실외') {
        score += weights.outdoorBonus;
    } else if (location === '실내') {
        score += weights.indoorBonus;
    }
    
    return score;
}

// 시간대 기반 점수 계산
function calculateTimeOfDayScore(clothing, timeOfDay) {
    if (!timeOfDay) return 0;
    
    let score = 0;
    const weights = RECOMMENDATION_WEIGHTS.timeOfDay;
    
    if (timeOfDay === '낮') {
        score += weights.dayBonus;
    } else if (timeOfDay === '밤') {
        score += weights.nightBonus;
    }
    
    return score;
}

// 부적합한 조합 체크 함수 (원피스 + 청바지 등)
function checkIncompatibleCombinations(outfit) {
    const weights = RECOMMENDATION_WEIGHTS.incompatibleCombinations;
    let penalty = 0;
    
    // 원피스 + 하의 조합 불가능
    if (outfit.top && (outfit.top.name.includes('원피스') || outfit.top.name.includes('드레스'))) {
        if (outfit.bottom) {
            penalty += weights.penalty; // 원피스는 하의와 함께 입을 수 없음
        }
    }
    
    // 치마 + 바지 동시 착용 불가 (하나만 있어야 함)
    if (outfit.bottom) {
        const bottomName = outfit.bottom.name.toLowerCase();
        if (bottomName.includes('치마') || bottomName.includes('스커트')) {
            // 치마는 정상
        }
    }
    
    // 정장 조합 규칙: 정장 상의는 정장 하의와 어울림
    if (outfit.top && outfit.top.name.includes('정장')) {
        if (outfit.bottom && !outfit.bottom.name.includes('바지') && !outfit.bottom.name.includes('슬랙스')) {
            penalty += weights.penalty / 2; // 정장 상의는 정장 바지와 어울림
        }
    }
    
    return penalty;
}

// 색상 조화 점수 계산 (AI 기반, 가중치 시스템 사용)
function calculateColorHarmonyScore(clothing, otherClothes) {
    if (!clothing.colors || !clothing.colors[0]) return 0;
    
    let harmonyScore = 0;
    const mainColor = clothing.colors[0].rgb;
    const weights = RECOMMENDATION_WEIGHTS.colorHarmony;
    
    // 다른 옷들과의 색상 조화 계산
    otherClothes.forEach(otherClothing => {
        if (!otherClothing.colors || !otherClothing.colors[0]) return;
        
        const otherMainColor = otherClothing.colors[0].rgb;
        const harmony = calculateColorHarmony(mainColor, otherMainColor, weights);
        harmonyScore += harmony;
    });
    
    return harmonyScore;
}

// 두 색상 간의 조화 점수 계산 (가중치 적용)
function calculateColorHarmony(color1, color2, weights) {
    // RGB를 HSV로 변환
    const hsv1 = rgbToHsv(color1.r, color1.g, color1.b);
    const hsv2 = rgbToHsv(color2.r, color2.g, color2.b);
    
    const hueDiff = Math.abs(hsv1.h - hsv2.h);
    const normalizedHueDiff = Math.min(hueDiff, 360 - hueDiff); // 색상환에서의 최단 거리
    const brightnessDiff = Math.abs(hsv1.v - hsv2.v);
    const saturationDiff = Math.abs(hsv1.s - hsv2.s);
    
    // 1. 유사 색상 (Analogous) - 색상환에서 30도 이내
    if (normalizedHueDiff <= 30) {
        return weights.analogous;
    }
    
    // 2. 보색 (Complementary) - 색상환에서 150-210도
    if (normalizedHueDiff >= 150 && normalizedHueDiff <= 210) {
        return weights.complementary;
    }
    
    // 3. 삼원색 조화 (Triadic) - 120도 차이
    const triadicDiff1 = Math.abs(normalizedHueDiff - 120);
    const triadicDiff2 = Math.abs(normalizedHueDiff - 240);
    if (triadicDiff1 <= 15 || triadicDiff2 <= 15) {
        return weights.triadic;
    }
    
    // 4. 단색 조화 (Monochromatic) - 같은 색상 계열, 다른 명도
    if (normalizedHueDiff <= 15 && (brightnessDiff > 0.2 || saturationDiff > 0.2)) {
        return weights.monochromatic;
    }
    
    // 5. 중성색 (검정, 흰색, 회색, 베이지)은 거의 모든 색과 잘 어울림
    if (isNeutralColor(color1) || isNeutralColor(color2)) {
        return weights.neutral;
    }
    
    // 6. 무채색 계열 조화
    const color1Saturation = hsv1.s;
    const color2Saturation = hsv2.s;
    if ((color1Saturation < 0.2 && color2Saturation < 0.5) || 
        (color2Saturation < 0.2 && color1Saturation < 0.5)) {
        return weights.desaturated;
    }
    
    // 나쁜 조합은 음수 점수 (너무 비슷한 색상은 피함)
    if (normalizedHueDiff <= 10 && brightnessDiff < 0.1 && saturationDiff < 0.1) {
        return weights.tooSimilar;
    }
    
    return 0;
}

// RGB를 HSV로 변환
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
        if (max === r) {
            h = ((g - b) / diff) % 6;
        } else if (max === g) {
            h = (b - r) / diff + 2;
        } else {
            h = (r - g) / diff + 4;
        }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    const s = max === 0 ? 0 : diff / max;
    const v = max;
    
    return { h, s, v };
}

// 중성색 판단
function isNeutralColor(color) {
    const { r, g, b } = color;
    // 회색 계열 (R, G, B 값이 비슷함)
    const grayDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (grayDiff < 30) {
        return true;
    }
    
    // 검정, 흰색, 베이지 등
    if (r < 50 && g < 50 && b < 50) return true; // 검정
    if (r > 240 && g > 240 && b > 240) return true; // 흰색
    if (r > 200 && g > 200 && b > 180 && b < 230) return true; // 베이지
    if (r > 240 && g > 235 && b > 220) return true; // 아이보리
    
    return false;
}

// AI 기반 옷 점수 계산 (가중치 시스템 사용, 모듈화 및 확장 가능)
function calculateClothingScore(clothing, event, temperature, humidity, usedItems, otherClothesInOutfit = [], weather = '맑음', activityType = '', location = '실외', timeOfDay = '낮') {
    let score = 0;
    const clothingId = clothing.id || clothing.name;
    const weights = RECOMMENDATION_WEIGHTS;
    
    // 빨래 중인 옷은 추천하지 않음
    if (clothing.status === 'washing') {
        return weights.status.washing;
    }
    
    // 이번주에 입지 않은 옷에 보너스 점수 부여 (우선 추천)
    if (!thisWeekUsedItems.has(clothingId)) {
        score += weights.unusedThisWeekBonus;
    }
    
    // 태그 정확 일치 (높은 점수)
    if (clothing.tags.includes(event)) {
        score += weights.tagExactMatch;
    }
    
    // 태그 부분 일치
    const hasPartialMatch = clothing.tags.some(tag => 
        tag.includes(event) || event.includes(tag)
    );
    if (hasPartialMatch) {
        score += weights.tagPartialMatch;
    }
    
    // 기온/습도/날씨 기반 점수 (날씨 적합성)
    score += calculateWeatherScore(clothing, temperature, humidity, weather, otherClothesInOutfit);
    
    // 활동 유형 기반 점수
    score += calculateActivityTypeScore(clothing, activityType);
    
    // 장소 기반 점수
    score += calculateLocationScore(clothing, location);
    
    // 시간대 기반 점수
    score += calculateTimeOfDayScore(clothing, timeOfDay);
    
    // 색상 조화 기반 점수 (AI 기반) - 다른 옷들과의 조화 고려
    if (otherClothesInOutfit.length > 0) {
        score += calculateColorHarmonyScore(clothing, otherClothesInOutfit);
    }
    
    // 태그 개수 (더 많은 태그 = 더 다양한 스타일 가능)
    score += clothing.tags.length * weights.tagCountMultiplier;
    
    // 사용 가능한 옷에 가산점
    if (clothing.status === 'ready' || !clothing.status) {
        score += weights.status.ready;
    } else if (clothing.status === 'clean') {
        score += weights.status.clean;
    }
    
    // 9°C 이하일 때 아우터는 점수 하한선 보장 (다른 감점 요소가 있어도 최소 200점 이상)
    if (temperature <= 9 && clothing.category === '아우터') {
        score = Math.max(score, 200); // 최소 200점 보장
    }
    
    // 상의는 기본적으로 추천되도록 보장 (점수가 너무 낮아도 최소 80점 이상)
    // 기온에 관계없이 데이트 등 모든 상황에서 추천되도록 높은 최소 점수 보장
    if (clothing.category === '상의') {
        score = Math.max(score, 80); // 최소 80점 보장하여 데이트 등 모든 상황에서 추천되도록
    }
    
    // 하의도 기본적으로 추천되도록 보장
    if (clothing.category === '하의') {
        score = Math.max(score, 50); // 최소 50점 보장
    }
    
    // 랜덤 요소 추가 (약간의 다양성)
    score += Math.random() * weights.randomness;
    
    return score;
}

// 현재 계절 가져오기
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return '봄';
    if (month >= 6 && month <= 8) return '여름';
    if (month >= 9 && month <= 11) return '가을';
    return '겨울';
}

// 일정에 맞는 코디 찾기 (AI 기반)
function findMatchingOutfit(event, temperature = 20, humidity = 60, usedItems = new Set(), weather = '맑음', activityType = '', location = '실외', timeOfDay = '낮') {
    const outfit = {
        outer: null,
        top: null,
        bottom: null,
        shoes: null,
        reason: ''
    };
    
    // 사용 가능한 옷만 필터링 (빨래 중 제외, 모든 옷 중복 허용)
    const availableClothes = wardrobe.filter(clothing => 
        clothing.status !== 'washing'
    );
    
    if (availableClothes.length === 0) {
        outfit.reason = '사용 가능한 옷이 없습니다. 빨래 중인 옷이 있는지 확인해주세요.';
        return outfit;
    }
    
    // 카테고리별 후보 선택 함수: 태그 매칭 옷이 없으면 해당 카테고리 모든 옷 포함
    // 결과적으로 모든 태그에 대해 동일한 방식으로 작동 (태그 매칭 없으면 다른 태그 옷 추천)
    // 태그 매칭 옷은 점수 계산(calculateClothingScore)에서 가중치로 우선되므로 자동으로 우선 추천됨
    // 모든 옷 중복 허용 (이번주 미사용 옷이 우선 추천됨)
    const getCandidatesForCategory = (category) => {
        return availableClothes.filter(c => 
            c.category === category && 
            c.status !== 'washing'
        );
    };
    
    // 카테고리별 옷 선택 및 점수 계산을 위한 공통 함수
    const selectItemForCategory = (category, otherItemsInOutfit = []) => {
        const candidates = getCandidatesForCategory(category);
        
        if (candidates.length === 0) return null;
        
        // 점수 계산 및 정렬 (usedItems는 사용하지 않음, 이번주 미사용 옷 보너스는 calculateClothingScore 내부에서 처리)
        const scoredItems = candidates
            .map(item => ({
                item,
                score: calculateClothingScore(
                    item, event, temperature, humidity, new Set(), 
                    otherItemsInOutfit, weather, activityType, location, timeOfDay
                )
            }))
            .sort((a, b) => b.score - a.score);
        
        return scoredItems.length > 0 ? scoredItems : null;
    };
    
    
    // 카테고리별 옷 선택 및 점수 계산 (순차적으로 색상 조화 고려)
    const otherItems = [];
    
    // 1. 아우터 선택 (기온별 조건부 추천)
    const outers = selectItemForCategory('아우터', []);
    if (outers && outers.length > 0) {
        if (temperature <= 9) {
            // 9°C 이하일 때는 무조건 아우터 선택
            outfit.outer = outers[0].item;
        } else if (temperature >= 10 && temperature <= 20) {
            // 10~20°C일 때는 얇은 아우터 추천 (점수 조건 완화)
            const highScored = outers.filter(o => o.score > 0 && o.score === outers[0].score);
            if (highScored.length > 0) {
                outfit.outer = highScored[Math.floor(Math.random() * highScored.length)].item;
            }
        }
        // 20~30°C일 때는 아우터 추천 안 함 (여름 옷 추천 우선)
        // 아우터가 없어도 상의, 하의, 신발은 항상 추천됨
        if (outfit.outer) {
            otherItems.push(outfit.outer);
        }
    }
    
    // 2. 상의 선택 (필수 추천, 항상 추천)
    const tops = selectItemForCategory('상의', otherItems);
    if (tops && tops.length > 0) {
        // 상의는 항상 추천 (점수 조건 완화)
        const topCandidates = tops.filter(t => t.score === tops[0].score);
        outfit.top = topCandidates.length > 0 
            ? topCandidates[Math.floor(Math.random() * topCandidates.length)].item
            : tops[0].item;
        
        if (outfit.top) {
            otherItems.push(outfit.top);
        }
    } else {
        // 상의가 없으면 기본 상의 선택 또는 경고 메시지
        outfit.reason = '사용 가능한 상의가 없습니다.';
        return outfit;
    }
    
    // 3. 하의 선택 (필수 추천, 항상 추천)
    const bottoms = selectItemForCategory('하의', otherItems);
    if (bottoms && bottoms.length > 0) {
        // 하의는 항상 추천 (점수 조건 완화)
        const bottomCandidates = bottoms.filter(b => 
            b.score === bottoms[0].score
        );
        if (bottomCandidates.length > 0) {
            outfit.bottom = bottomCandidates[Math.floor(Math.random() * bottomCandidates.length)].item;
        } else {
            // 최고 점수 하의 선택 (점수가 낮아도 선택)
            outfit.bottom = bottoms[0].item;
        }
        
        if (outfit.bottom) {
            otherItems.push(outfit.bottom);
        }
    } else {
        // 하의가 없으면 기본 하의 선택 또는 경고 메시지
        outfit.reason = '사용 가능한 하의가 없습니다.';
        return outfit;
    }
    
    // 4. 신발 선택 (필수 추천, 항상 추천, 중복 허용)
    const shoesList = selectItemForCategory('신발', otherItems);
    if (shoesList && shoesList.length > 0) {
        // 신발은 항상 추천 (점수 조건 완화)
        const shoeCandidates = shoesList.filter(s => 
            s.score === shoesList[0].score
            // 신발은 중복 허용이므로 usedItems 체크 제외
        );
        if (shoeCandidates.length > 0) {
            outfit.shoes = shoeCandidates[Math.floor(Math.random() * shoeCandidates.length)].item;
        } else {
            // 최고 점수 신발 선택 (점수가 낮아도 선택)
            outfit.shoes = shoesList[0].item;
        }
        // 신발은 중복 허용이므로 usedItems에 추가하지 않음
    } else {
        // 신발이 없으면 기본 신발 선택 또는 경고 메시지
        outfit.reason = '사용 가능한 신발이 없습니다.';
        return outfit;
    }
    
    // 부적합한 조합 체크 및 점수 조정
    const incompatibilityPenalty = checkIncompatibleCombinations(outfit);
    if (incompatibilityPenalty < 0) {
        // 부적합한 조합인 경우, 각 아이템의 점수를 감점하거나 제외
        const weights = RECOMMENDATION_WEIGHTS.incompatibleCombinations;
        if (incompatibilityPenalty <= weights.excludeThreshold) {
            // 추천 제외 수준이면 빈 코디 반환
            outfit.reason = '부적합한 조합입니다. (예: 원피스 + 하의)';
            return outfit;
        }
    }
    
    // 추천 이유 생성 (AI 기반)
    let reasonParts = [];
    const matchedTags = [];
    if (outfit.outer) matchedTags.push(...outfit.outer.tags);
    if (outfit.top) matchedTags.push(...outfit.top.tags);
    if (outfit.bottom) matchedTags.push(...outfit.bottom.tags);
    if (outfit.shoes) matchedTags.push(...outfit.shoes.tags);
    
    const eventMatch = matchedTags.includes(event) || 
                      matchedTags.some(tag => tag.includes(event) || event.includes(tag));
    
    if (eventMatch) {
        reasonParts.push('태그 매칭');
    }
    
    // 기온/습도 기반 추천 이유
    if (temperature <= 5) {
        reasonParts.push(`기온 ${temperature}°C로 추워서`);
    } else if (temperature <= 15) {
        reasonParts.push(`기온 ${temperature}°C로 쌀쌀해서`);
    } else if (temperature <= 25) {
        reasonParts.push(`기온 ${temperature}°C에 적합한`);
    } else {
        reasonParts.push(`기온 ${temperature}°C로 더워서`);
    }
    
    if (humidity >= 70) {
        reasonParts.push(`습도 ${humidity}%로 높아 시원한 소재로`);
    }
    
    if (event === '회의') {
        reasonParts.push('회의 일정에 맞는 포멀한 비즈니스 룩으로 추천');
    } else if (event === '운동') {
        reasonParts.push('운동 일정에 맞는 편안하고 활동하기 좋은 스타일로 추천');
    } else if (event === '데이트') {
        reasonParts.push('데이트 일정에 맞는 깔끔하고 세련된 스타일로 추천');
    } else if (event === '캐주얼') {
        reasonParts.push('캐주얼한 일정에 맞는 편안하고 일상적인 룩으로 추천');
    } else {
        reasonParts.push(`${event} 일정에 최적화된 스타일로 추천`);
    }
    
    outfit.reason = reasonParts.join(' ');
    
    return outfit;
}

// 추천 결과 표시
function displayRecommendations(recommendations) {
    const recommendationsSection = document.getElementById('recommendations-section');
    const recommendationsList = document.getElementById('recommendations-list');
    
    recommendationsSection.style.display = 'block';
    
    recommendationsList.innerHTML = recommendations.map(rec => {
        const outfit = rec.outfit;
        const hasItems = outfit.outer || outfit.top || outfit.bottom || outfit.shoes;
        
        let outfitItemsHTML = '';
        if (hasItems) {
            outfitItemsHTML = '<div class="outfit-items">';
            if (outfit.outer) {
                outfitItemsHTML += `
                    <div class="outfit-item">
                        ${outfit.outer.image 
                            ? `<img src="${outfit.outer.image}" alt="${outfit.outer.name}" class="outfit-item-image">`
                            : `<div class="outfit-item-no-image">🧥</div>`
                        }
                        <div class="outfit-item-category">아우터</div>
                        <div class="outfit-item-name">${outfit.outer.name}</div>
                        <span class="season-badge" style="font-size: 0.75rem;">${outfit.outer.season}</span>
                    </div>
                `;
            }
            if (outfit.top) {
                outfitItemsHTML += `
                    <div class="outfit-item">
                        ${outfit.top.image 
                            ? `<img src="${outfit.top.image}" alt="${outfit.top.name}" class="outfit-item-image">`
                            : `<div class="outfit-item-no-image">👔</div>`
                        }
                        <div class="outfit-item-category">상의</div>
                        <div class="outfit-item-name">${outfit.top.name}</div>
                        <span class="season-badge" style="font-size: 0.75rem;">${outfit.top.season}</span>
                    </div>
                `;
            }
            if (outfit.bottom) {
                outfitItemsHTML += `
                    <div class="outfit-item">
                        ${outfit.bottom.image 
                            ? `<img src="${outfit.bottom.image}" alt="${outfit.bottom.name}" class="outfit-item-image">`
                            : `<div class="outfit-item-no-image">👖</div>`
                        }
                        <div class="outfit-item-category">하의</div>
                        <div class="outfit-item-name">${outfit.bottom.name}</div>
                        <span class="season-badge" style="font-size: 0.75rem;">${outfit.bottom.season}</span>
                    </div>
                `;
            }
            if (outfit.shoes) {
                outfitItemsHTML += `
                    <div class="outfit-item">
                        ${outfit.shoes.image 
                            ? `<img src="${outfit.shoes.image}" alt="${outfit.shoes.name}" class="outfit-item-image">`
                            : `<div class="outfit-item-no-image">👟</div>`
                        }
                        <div class="outfit-item-category">신발</div>
                        <div class="outfit-item-name">${outfit.shoes.name}</div>
                        <span class="season-badge" style="font-size: 0.75rem;">${outfit.shoes.season}</span>
                    </div>
                `;
            }
            outfitItemsHTML += '</div>';
        } else {
            outfitItemsHTML = '<div class="no-outfit">일치하는 옷이 없습니다.</div>';
        }
        
        return `
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-day">${rec.day}</div>
                    <div class="recommendation-event">${rec.event}</div>
                    ${rec.temperature !== undefined ? `<div class="recommendation-weather">🌡️ ${rec.temperature}°C | 💧 ${rec.humidity}%</div>` : ''}
                </div>
                ${outfitItemsHTML}
                <div class="recommendation-reason">
                    💡 ${outfit.reason}
                </div>
            </div>
        `;
    }).join('');
    
    // 결과 섹션으로 스크롤
    recommendationsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
