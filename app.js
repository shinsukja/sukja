// ✅ App.js — 실시간 API 연동 수정본

const WEATHER_API_KEY = "cpxZINvyvRtA5reKpGGNrT/Ggj0K4cPq135hPAr5iZY9ZOxz48aVc++XN9o0M3tr5zAjkseNHF+P+Vebl3DBQw==";
const ROAD_API_KEY = "4570425724";

let markers = [], routeControl = null, currentSpot = null;

// 지도 초기화
const map = L.map('map').setView([35.1595, 126.8526], 9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 관광지 데이터
const touristSpots = [
  { id:1, name:'광주 유스퀘어', lat:35.1605, lng:126.8811, sido:'광주광역시', gungu:'서구', departureTime:'08:50' },
  { id:2, name:'광주송정역', lat:35.1393, lng:126.7916, sido:'광주광역시', gungu:'광산구', departureTime:'09:20' },
  { id:3, name:'장성호 문화예술공원', lat:35.3547, lng:126.7772, sido:'전라남도', gungu:'장성군' },
  { id:4, name:'백양사', lat:35.4469, lng:126.9054, sido:'전라남도', gungu:'장성군' },
  { id:5, name:'메타세쿼이아 가로수길', lat:35.3214, lng:126.9858, sido:'전라남도', gungu:'담양군' },
  { id:6, name:'관방제림', lat:35.3173, lng:126.9903, sido:'전라남도', gungu:'담양군' },
  { id:7, name:'죽녹원', lat:35.3210, lng:126.9890, sido:'전라남도', gungu:'담양군' }
];

// 경로 그리기
function drawTourRoute() {
  if (routeControl) map.removeControl(routeControl);
  const waypoints = touristSpots.map(s => L.latLng(s.lat, s.lng));
  routeControl = L.Routing.control({
    waypoints,
    addWaypoints: false,
    draggableWaypoints: false,
    createMarker: () => null
  }).addTo(map);
}

document.addEventListener('DOMContentLoaded', () => {
  drawTourRoute();
  renderMarkers();
  renderSpotList();
  updateLastUpdateTime();
  // 5분마다 현재 선택된 스팟 정보 갱신
  setInterval(() => { if (currentSpot) showWeatherAndRoadInfo(currentSpot); }, 5 * 60 * 1000);
});

// 마커 렌더링
function renderMarkers() {
  markers = [];
  touristSpots.forEach((spot, idx) => {
    const m = L.marker([spot.lat, spot.lng])
      .addTo(map)
      .bindPopup(`<strong>${spot.name}</strong>`)
      .on('click', () => showWeatherAndRoadInfo(spot));
    markers.push(m);
  });
}

// 한줄 목록 표시
function renderSpotList() {
  const list = document.getElementById('tourist-spots-list');
  list.innerHTML = touristSpots
    .map(s => `<span class="tourist-spot-inline" data-id="${s.id}">` +
               `${s.name}${s.departureTime?` (${s.departureTime})`:''}` +
               `</span>`)
    .join(' ➔ ');
  document.querySelectorAll('.tourist-spot-inline').forEach(span => {
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => {
      const id = Number(span.dataset.id);
      const idx = touristSpots.findIndex(s => s.id === id);
      const spot = touristSpots[idx];
      map.setView([spot.lat, spot.lng], 13);
      markers[idx].openPopup();
      showWeatherAndRoadInfo(spot);
    });
  });
}

// 마지막 업데이트 표시
function updateLastUpdateTime() {
  document.getElementById('last-update').textContent =
    `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
}

// 정보 표시 핸들러
function showWeatherAndRoadInfo(spot) {
  currentSpot = spot;
  document.getElementById('weather-info').innerHTML = `<strong>${spot.name}</strong><br>날씨 로딩 중...`;
  document.getElementById('road-status').innerHTML = `<strong>${spot.name}</strong><br>도로 로딩 중...`;
  fetchWeatherInfo(spot);
  fetchTrafficInfo(spot);
  updateLastUpdateTime();
}

// 날씨 정보 가져오기 (기상청 단기예보 API)
async function fetchWeatherInfo(spot) {
  try {
    // 좌표를 격자 좌표로 변환 (간단한 근사치 사용)
    const nx = Math.round((spot.lng - 124) * 5 + 1);
    const ny = Math.round((spot.lat - 33) * 5 + 1);
    
    const today = new Date();
    const baseDate = today.toISOString().slice(0,10).replace(/-/g,'');
    
    // 가장 가까운 발표시간 계산 (02, 05, 08, 11, 14, 17, 20, 23시)
    const hour = today.getHours();
    const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
    let baseTime = baseHours.reduce((prev, curr) => 
      (Math.abs(curr - hour) < Math.abs(prev - hour) ? curr : prev));
    
    if (hour < baseTime) {
      // 전날의 마지막 발표시간 사용
      today.setDate(today.getDate() - 1);
      baseTime = 23;
    }
    
    const baseTimeStr = baseTime.toString().padStart(2, '0') + '00';
    const baseDateStr = today.toISOString().slice(0,10).replace(/-/g,'');
    
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
                `?serviceKey=${encodeURIComponent(WEATHER_API_KEY)}` +
                `&pageNo=1&numOfRows=100&dataType=JSON` +
                `&base_date=${baseDateStr}&base_time=${baseTimeStr}` +
                `&nx=${nx}&ny=${ny}`;
    
    console.log('날씨 API URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('날씨 API 응답:', data);
    
    if (data.response?.body?.items?.item && data.response.body.items.item.length > 0) {
      const items = data.response.body.items.item;
      const currentTime = new Date().getHours().toString().padStart(2, '0') + '00';
      
      // 현재 시간에 가장 가까운 예보 데이터 찾기
      const currentData = {};
      items.forEach(item => {
        if (item.fcstTime === currentTime || !currentData[item.category]) {
          currentData[item.category] = item.fcstValue;
        }
      });
      
      const temp = currentData.TMP || '-';
      const sky = getSkyCondition(currentData.SKY);
      const pty = getPrecipitationType(currentData.PTY);
      const weatherCondition = pty !== '없음' ? pty : sky;
      
      document.getElementById('weather-info').innerHTML =
        `<strong>${spot.name}</strong><br>` +
        `현재 기온: ${temp}℃<br>` +
        `날씨: ${weatherCondition}`;
    } else {
      throw new Error('날씨 데이터를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('날씨 API 오류:', error);
    document.getElementById('weather-info').innerHTML =
      `<strong>${spot.name}</strong><br>날씨 정보를 불러올 수 없습니다.<br>` +
      `오류: ${error.message}`;
  }
}

// 하늘 상태 코드를 텍스트로 변환
function getSkyCondition(skyCode) {
  const skyConditions = {
    '1': '맑음',
    '3': '구름많음', 
    '4': '흐림'
  };
  return skyConditions[skyCode] || '정보없음';
}

// 강수 형태 코드를 텍스트로 변환
function getPrecipitationType(ptyCode) {
  const precipitationTypes = {
    '0': '없음',
    '1': '비',
    '2': '비/눈',
    '3': '눈',
    '5': '빗방울',
    '6': '빗방울눈날림',
    '7': '눈날림'
  };
  return precipitationTypes[ptyCode] || '없음';
}

// 교통 정보 가져오기 (한국도로공사 API)
async function fetchTrafficInfo(spot) {
  try {
    // 고속도로 교통량 정보 API
    const url = `https://data.ex.co.kr/openapi/business/curTrafByRegion` +
              `?key=${ROAD_API_KEY}&type=json&numOfRows=100&pageNo=1`;
    
    console.log('교통 API URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('교통 API 응답:', data);
    
    if (data && data.list && data.list.length > 0) {
      // 지역별로 가장 가까운 도로 정보 찾기
      let matchedRoad = null;
      
      // 지역별 매칭 로직
      for (const road of data.list) {
        const routeName = road.routeName || '';
        
        if (spot.sido.includes('광주')) {
          if (routeName.includes('호남고속도로') || routeName.includes('광주')) {
            matchedRoad = road;
            break;
          }
        } else if (spot.gungu.includes('장성')) {
          if (routeName.includes('호남고속도로') || routeName.includes('장성')) {
            matchedRoad = road;
            break;
          }
        } else if (spot.gungu.includes('담양')) {
          if (routeName.includes('호남고속도로') || routeName.includes('담양')) {
            matchedRoad = road;
            break;
          }
        }
      }
      
      // 매칭되는 도로가 없으면 첫 번째 호남고속도로 정보 사용
      if (!matchedRoad) {
        matchedRoad = data.list.find(road => 
          road.routeName?.includes('호남고속도로')) || data.list[0];
      }
      
      if (matchedRoad) {
        const congestionLevel = getTrafficLevel(matchedRoad.trafficLevel || matchedRoad.congestLevel);
        const roadName = matchedRoad.routeName || '도로정보';
        
        displayTrafficInfo(spot, {
          roadName: roadName,
          congestionLevel: congestionLevel,
          speed: matchedRoad.speed || '-'
        });
        return;
      }
    }
    
    // API 실패 시 기본 정보 표시
    throw new Error('교통 데이터를 찾을 수 없습니다.');
    
  } catch (error) {
    console.error('교통 API 오류:', error);
    
    // 기본 도로 상황 정보 표시
    const defaultRoads = {
      '광주광역시': '호남고속도로',
      '전라남도': '호남고속도로'
    };
    
    displayTrafficInfo(spot, {
      roadName: defaultRoads[spot.sido] || '일반도로',
      congestionLevel: '보통',
      speed: '-',
      error: true
    });
  }
}

// 교통량 레벨을 텍스트로 변환
function getTrafficLevel(level) {
  const levels = {
    '1': '원활',
    '2': '보통', 
    '3': '서행',
    '4': '정체'
  };
  return levels[level] || '보통';
}

// 교통 상태 표시
function displayTrafficInfo(spot, {roadName, congestionLevel, speed, error}) {
  const icons = {
    '원활': '🟢',
    '보통': '🟡', 
    '서행': '🟠',
    '정체': '🔴'
  };
  
  const time = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let statusText = `<strong>${spot.name}</strong><br>` +
                   `${icons[congestionLevel] || '⚫'} ${roadName}<br>` +
                   `상태: ${congestionLevel}`;
  
  if (speed && speed !== '-') {
    statusText += `<br>평균속도: ${speed}km/h`;
  }
  
  statusText += `<br><small>(${time} 기준)</small>`;
  
  if (error) {
    statusText += `<br><small style="color: #888;">* 실시간 데이터 연결 실패</small>`;
  }
  
  document.getElementById('road-status').innerHTML = statusText;
}