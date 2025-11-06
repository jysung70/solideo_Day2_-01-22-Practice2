# 여행 계획 웹 애플리케이션 (Travel Planner)

HTML, CSS, JavaScript만을 사용하여 개발한 반응형 여행 계획 웹 애플리케이션입니다.

## 주요 기능

### 1. 스마트 경로 탐색
- **다중 경로 옵션**: 자동차, 도보, 자전거 경로를 동시에 제공
- **최적 경로 추천**: 최단 시간, 최저 비용, 균형 잡힌 경로
- **실시간 거리/시간 계산**: OpenRouteService API 활용

### 2. 취향 기반 여행지 추천
- **6가지 카테고리**: 자연, 문화, 음식, 쇼핑, 역사, 모험
- **지능형 필터링**: 사용자 선호도에 맞춘 POI 검색
- **상세 정보 제공**: 예상 체류시간, 입장료 정보

### 3. 비용 계산 및 분석
- **전체 여행 비용 추정**: 교통비, 숙박비, 식비, 활동비
- **시각화 차트**: Chart.js를 활용한 비용 분석
- **예산 최적화**: 비용 절감 팁 제공

### 4. 인터랙티브 지도
- **Leaflet.js + OpenStreetMap**: 무료 오픈소스 지도
- **커스텀 마커**: 출발지(파란색), 도착지(빨간색), 추천 장소(노란색)
- **경로 시각화**: 다중 경로를 색상별로 구분 표시

### 5. 여행 계획 공유
- **Google Maps 연동**: 계획한 경로를 Google Maps로 보기
- **링크 공유**: URL을 통한 여행 계획 공유
- **검색 기록 저장**: 최근 5개 검색 자동 저장

### 6. 반응형 디자인
- **모바일 최적화**: 터치 친화적 UI, 스와이프 제스처
- **다양한 디바이스 지원**: Desktop, Tablet, Mobile
- **접근성 고려**: WCAG 가이드라인 준수

## 기술 스택

### Frontend
- **HTML5**: 시맨틱 마크업
- **CSS3**: Flexbox, Grid, Animations
- **JavaScript (ES6+)**: Vanilla JS, 모듈 패턴

### 라이브러리 & API
- **Leaflet.js**: 지도 시각화
- **Chart.js**: 데이터 차트
- **OpenRouteService API**: 경로 계산
- **Nominatim API**: 주소 검색
- **Overpass API**: POI 검색
- **Font Awesome**: 아이콘

## 프로젝트 구조

```
travel-app/
├── index.html              # 메인 HTML
├── css/
│   ├── style.css          # 메인 스타일시트
│   └── mobile.css         # 반응형 스타일
├── js/
│   ├── app.js             # 메인 애플리케이션 컨트롤러
│   ├── map.js             # 지도 모듈 (Leaflet)
│   ├── transport.js       # 교통/경로 모듈
│   ├── recommend.js       # 추천 시스템 모듈
│   └── cost.js            # 비용 계산 모듈
├── README.md              # 프로젝트 문서
└── LICENSE.md             # 라이선스
```

## 설치 및 실행

### 필수 요구사항
- 웹 브라우저 (Chrome, Firefox, Safari, Edge)
- 로컬 웹 서버 (Python, Node.js, 또는 VS Code Live Server)

### 실행 방법

#### 1. Python 사용
```bash
# Python 3.x
python -m http.server 8000

# Python 2.x
python -m SimpleHTTPServer 8000
```

브라우저에서 `http://localhost:8000` 접속

#### 2. Node.js 사용
```bash
# http-server 설치
npm install -g http-server

# 실행
http-server -p 8000
```

#### 3. VS Code Live Server
1. VS Code에서 프로젝트 열기
2. Live Server 확장 프로그램 설치
3. `index.html` 우클릭 → "Open with Live Server"

## 사용 방법

### 1. 여행 계획 시작
1. **출발지 입력**: 주소를 입력하면 자동완성 목록이 표시됩니다
2. **도착지 입력**: 도착할 장소를 선택하세요
3. **날짜 선택**: 출발 날짜와 시간을 지정하세요
4. **여행 기간**: 며칠 동안 여행할지 입력하세요
5. **취향 선택**: 관심 있는 카테고리를 선택하세요

### 2. 경로 확인
- **3가지 경로 옵션**이 표시됩니다
- 각 경로를 클릭하면 지도에 하이라이트됩니다
- 거리, 시간, 예상 비용을 비교할 수 있습니다

### 3. 추천 장소 탐색
- 선택한 취향에 맞는 **최대 15개 장소**가 표시됩니다
- 장소 카드를 클릭하면 지도에서 위치를 확인할 수 있습니다
- 예상 체류시간과 비용 정보를 제공합니다

### 4. 비용 확인
- **총 예상 비용**과 항목별 분석을 확인하세요
- 원형 차트로 비용 비율을 시각화합니다
- 비용 절감 팁을 참고하세요

### 5. 여행 계획 공유
- **Google Maps로 보기**: 모든 장소가 포함된 경로를 Google Maps에서 확인
- **링크 복사**: 친구들과 여행 계획을 공유하세요

## API 설정

### OpenRouteService API Key
기본으로 제공되는 API 키는 데모용입니다. 프로덕션 환경에서는 본인의 키를 발급받으세요.

1. [OpenRouteService](https://openrouteservice.org/dev/#/signup)에서 회원가입
2. API 키 발급 (무료: 2000 요청/일)
3. `js/transport.js` 파일의 `ORS_API_KEY` 변수를 업데이트

```javascript
const ORS_API_KEY = 'YOUR_API_KEY_HERE';
```

### 기타 API
- **Nominatim API**: 인증 불필요 (1초당 1요청 제한)
- **Overpass API**: 인증 불필요
- **Chart.js**: CDN 사용

## 브라우저 지원

| Browser | Version |
|---------|---------|
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

## 성능 최적화

- **Debouncing**: 주소 검색 입력 최적화 (300ms)
- **API Rate Limiting**: Nominatim API 요청 간격 제어
- **Lazy Loading**: 결과 섹션 지연 로딩
- **Local Storage**: 최근 검색 기록 저장
- **Responsive Images**: 모바일 최적화

## 문제 해결

### 지도가 표시되지 않는 경우
- 브라우저 콘솔에서 에러 확인
- 인터넷 연결 확인
- 로컬 서버로 실행 중인지 확인 (파일:// 프로토콜은 제한됨)

### 경로를 찾을 수 없는 경우
- 출발지와 도착지가 너무 멀리 떨어져 있지 않은지 확인
- API 키가 올바른지 확인
- OpenRouteService API 할당량 확인

### 추천 장소가 표시되지 않는 경우
- 해당 지역에 OSM 데이터가 충분한지 확인
- 다른 취향 카테고리를 선택해보세요
- 검색 반경을 넓혀보세요

## 향후 계획

- [ ] 다국어 지원 (영어, 일본어, 중국어)
- [ ] 날씨 정보 통합
- [ ] 사용자 계정 및 저장 기능
- [ ] 오프라인 모드 (PWA)
- [ ] 소셜 미디어 공유
- [ ] 여행 일정 최적화 알고리즘
- [ ] 실시간 교통 정보

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포할 수 있습니다.

## 기여

이슈와 풀 리퀘스트를 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 크레딧

- **Maps**: [OpenStreetMap](https://www.openstreetmap.org/) contributors
- **Routing**: [OpenRouteService](https://openrouteservice.org/)
- **Icons**: [Font Awesome](https://fontawesome.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)

## 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 생성해주세요.

---

**즐거운 여행 되세요! ✈️**
