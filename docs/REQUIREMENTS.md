# DCIM Management System - Requirements

## 1. 시스템 개요

### 1.1 목적
기존 Grafana 기반 서버 모니터링을 대체하는 전문적인 DCIM 웹 애플리케이션으로,
데이터센터 인프라의 물리적/논리적 자원을 통합 관리한다.

### 1.2 사용자
- **관리자 (Admin)**: 자산 관리, 사용자 관리, 시스템 설정, 장비 등록/수정/삭제
- **운영자 (Operator)**: 일상적인 모니터링, 알림 대응, 제한적 장비 상태 변경
- **뷰어 (Viewer)**: 리포트 및 대시보드 조회 (읽기 전용)

### 1.3 물리 계층 구조
```
DataCenter (1개)
├── Room (현재 2개: "Server Room A", "Server Room B")
│   ├── Rack (여러 개, rowLabel로 그룹핑, sortOrder로 순서)
│   │   ├── Equipment (rackPosition: U위치, rackHeight: 높이)
│   │   │   ├── EquipmentCpu (소켓별 CPU 정보)
│   │   │   └── EquipmentMemory (슬롯별 DIMM 정보) ★
│   │   └── PDU (전원 분배 장치)
│   └── ...
└── ...
```

---

## 2. 기능 요구사항

### 2.1 Dashboard (메인 대시보드)
- [ ] 전체 서버 가동률 표시 (가동 중 / 경고 / 다운)
- [ ] 실시간 알림 피드 (최근 알림 5~10건)
- [ ] PUE (Power Usage Effectiveness) 현재 값 + 24시간 추이
- [ ] 전체 데이터센터 온도 분포 히트맵
- [ ] 총 전력 소비량 게이지
- [ ] 네트워크 트래픽 요약 (인바운드/아웃바운드)
- [ ] 서버 상태별 분류 차트 (정상/경고/위험/유지보수)
- [ ] 빠른 액세스: 최근 조회한 서버 바로가기

### 2.2 Server Monitoring (서버 모니터링)
- [ ] **듀얼 뷰**: 리스트(테이블) 뷰 ↔ 디지털 트윈(물리적 탐색) 뷰 토글
- [ ] 서버 목록 테이블 (검색, 필터, 정렬, 페이지네이션)
- [ ] 서버 상세 페이지:
  - CPU 사용률 (코어별) 실시간 그래프
  - CPU 상세 정보 (모델, 코어수, 클럭, 소켓별) - 등록 시 입력
  - Memory 사용률 + swap
  - Disk I/O 및 용량
  - Network 대역폭 (인터페이스별)
  - 온도 센서 (CPU, GPU, 보드, 인렛/아웃렛)
  - PCIe bandwidth 모니터링
  - 전력 소비량 (PDU 연동)
  - IPMI/BMC 센서 데이터
- [ ] 시간 범위 선택 (1시간, 6시간, 24시간, 7일, 30일, 커스텀)
- [ ] 메트릭 비교 모드 (서버 2~4대 비교)
- [ ] 서버 그룹핑 (클러스터, 용도, 위치별)

### 2.3 Memory Detail Page ★ HIGH PRIORITY
메모리 정보가 특히 중요하므로 별도의 상세 페이지 필요.
- [ ] **메모리 요약**: 총 DIMM 슬롯 수, 장착 수, 빈 슬롯, 총 용량
- [ ] **DIMM 슬롯 테이블** (접기/펼치기: CPU 소켓별 그룹):
  - 슬롯명 | 장착여부 | 제조사 | 파트넘버 | 타입(DDR4/DDR5/HBM) | 용량 | 속도 | Rank | ECC | 폼팩터
- [ ] **메모리 채널 다이어그램**: CPU → 채널 → DIMM 슬롯 시각적 레이아웃
- [ ] **실시간 메모리 사용률**: Prometheus에서 가져온 실시간 차트
- [ ] DIMM 정보는 장비 등록/수정 시 수동 입력
- [ ] 지원 메모리 타입: DDR3, DDR4, DDR5, HBM, HBM2, HBM2E, HBM3

### 2.4 Infrastructure Management (인프라 관리)
장비 추가/관리/라이프사이클 상태 변경을 위한 메뉴.
- [ ] 장비 등록 폼:
  - 기본 정보 (호스트명, IP, 시리얼번호, 제조사, 모델)
  - CPU 정보 (소켓별: 제조사, 모델, 코어, 스레드, 클럭, TDP)
  - 메모리 정보 (슬롯별 DIMM 상세) - 수동 입력
  - 위치 정보: Room 선택 → Rack 선택 → U 위치 + 높이 지정
- [ ] 장비 라이프사이클 상태 관리:
  - `계획(PLANNED)` → `입고(RECEIVING)` → `설치(INSTALLED)` → `운영(ACTIVE)`
  - `운영(ACTIVE)` → `유지보수(MAINTENANCE)` → `운영(ACTIVE)`
  - `운영(ACTIVE)` → `수리(REPAIR)` → `운영(ACTIVE)` (수리 의뢰/복귀)
  - `운영(ACTIVE)` → `장애(FAILED)` → `수리(REPAIR)` 또는 `퇴역(DECOMMISSIONED)`
  - `퇴역(DECOMMISSIONED)` → `폐기(DISPOSED)`
- [ ] 장비 상세 페이지: 접기/펼치기로 CPU, Memory, Disk, Network 섹션 관리
- [ ] 장비 검색 (시리얼번호, IP, 호스트명, 위치)
- [ ] 자산 변경 이력 (audit log)

### 2.5 Digital Twin View (물리적 탐색 뷰)
서버를 물리적 위치 기반으로 찾아가는 뷰.
- [ ] **Level 1 - Room 선택**: Room 카드 (이름, 요약 정보)
- [ ] **Level 2 - Room 평면도**: SVG 기반 랙 배치도, 클릭 시 랙 진입
  - 랙 색상: 온도/가동률 기반 히트맵
  - 빈 U 슬롯 수 표시
- [ ] **Level 3 - Rack Elevation**: SVG 랙 전면 뷰 (42U)
  - 장비 블록 (U 높이만큼 차지)
  - 상태별 색상 (Active=초록, Warning=노랑, Failed=빨강, Empty=회색)
  - 장비 클릭 시 상세 팝오버/패널
- [ ] 리스트 뷰 ↔ 트윈 뷰 토글 (URL: `/servers?view=list` or `?view=twin`)

### 2.6 Rack Visualization (랙 시각화)
- [ ] Room별 랙 목록 (rowLabel로 그룹핑, sortOrder로 순서)
- [ ] 개별 랙 전면/후면 뷰 (U 단위 장비 배치)
- [ ] 랙 히트맵 (온도 기반 색상)
- [ ] 랙 전력 사용률 게이지
- [ ] 빈 U 슬롯 표시 (용량 확인)

### 2.7 Alert Management (알림 관리)
- [ ] 알림 규칙 CRUD (메트릭, 임계치, 지속시간, 심각도)
- [ ] **알림 이력**: 날짜별 접기/펼치기 (Accordion)
- [ ] **카테고리 필터**: 심각도, 서버, 기간, 상태, 카테고리별 필터링
- [ ] 알림 승인(acknowledge) / 해제(resolve) 워크플로
- [ ] 알림 에스컬레이션 정책 설정
- [ ] 알림 수신 채널 설정 (이메일, Slack, Teams)
- [ ] 유지보수 창(maintenance window) 설정 (알림 억제)
- [ ] 알림 대시보드 (활성 알림 현황)

### 2.8 Capacity Planning (용량 계획)
- [ ] 전력 용량 현황 (사용 중 / 가용 kW)
- [ ] 랙 공간 현황 (사용 중 / 가용 U)
- [ ] 냉각 용량 현황
- [ ] 네트워크 포트 사용률
- [ ] 용량 추세 그래프 (과거 + 예측)
- [ ] "What-if" 시뮬레이션 (서버 N대 추가 시 영향 분석)

### 2.9 Reports (리포트)
- [ ] 가동률 리포트 (서버별, 기간별)
- [ ] 전력 소비 리포트
- [ ] 인시던트 리포트 (알림 통계)
- [ ] 자산 현황 리포트
- [ ] 커스텀 리포트 빌더
- [ ] PDF / CSV 내보내기
- [ ] 주기적 리포트 자동 발송

### 2.10 Settings (설정 - Admin Only)
- [ ] 사용자 관리 (CRUD, 역할 할당)
- [ ] Prometheus 자동 탐지 관리 (수동 동기화 버튼, 타겟 매핑)
- [ ] 시스템 설정

---

## 3. 비기능 요구사항

### 3.1 성능
- 대시보드 초기 로드: < 2초
- 실시간 메트릭 갱신 주기: 5~15초
- API 응답 시간: < 500ms (p95)
- 동시 사용자: 최소 50명

### 3.2 보안
- RBAC (Role-Based Access Control): Admin / Operator / Viewer
- API 인증: NextAuth.js (CredentialsProvider + JWT)
- 자체 인증 (이메일 + 비밀번호) - LDAP/SSO 불필요
- 감사 로그 (audit trail)
- 세션 타임아웃

### 3.3 가용성
- 99.9% 가용성 목표
- 데이터 백업 정책 (PostgreSQL)

### 3.4 UI/UX
- 반응형 디자인 (데스크톱 우선, 태블릿 지원)
- 다크 모드 기본 (라이트 모드 옵션)
- 다국어 지원 (한국어 / 영어)
- **접기/펼치기 UI 패턴**: 정보가 많은 페이지에서 Accordion/Collapsible 적용
  - Memory Detail: CPU 소켓별 DIMM 그룹
  - Alert History: 날짜별 그룹
  - Equipment Detail: CPU, Memory, Disk, Network 섹션
  - Rack View: 장비 정보 패널

---

## 4. 데이터 소스 연동

### 4.1 메트릭 수집
| 소스 | URL / 프로토콜 | 수집 대상 |
|------|----------------|-----------|
| **Prometheus** | `http://10.144.38.100:30004` | CPU, Memory, Disk, Network |
| IPMI/BMC | IPMI | 온도, 전력, 팬 속도 |
| SNMP | SNMP v2c/v3 | 네트워크 장비, PDU |
| node_exporter | Prometheus | OS 레벨 메트릭 |
| dcgm-exporter | Prometheus | GPU 메트릭 (있는 경우) |

### 4.2 서버 자동 탐지
- Prometheus `/api/v1/targets` API로 active target 목록 조회
- PrometheusTarget 테이블에 동기화 (instance, job, labels, health)
- Admin이 수동으로 "Sync Now" 버튼으로 실행
- 미매핑 타겟을 Equipment 레코드에 연결

### 4.3 기존 Grafana 대시보드
- 동일 Prometheus 데이터소스를 공유하여 병행 운영 가능
- 점진적 마이그레이션

---

## 5. 구현 단계 (Phase)

### Phase 1: Foundation (MVP)
- 프로젝트 셋업 (Next.js, DB, Docker)
- 사용자 인증/인가 (NextAuth.js + RBAC)
- Prisma 스키마 (Room, Rack, Equipment, EquipmentCpu, EquipmentMemory)
- 메인 대시보드 (기본 위젯)
- 서버 목록 + 기본 상세 페이지
- **Memory Detail Page** (HIGH PRIORITY)
- Prometheus 연동 (기본 메트릭 + 자동 탐지)

### Phase 2: Core Features
- Infrastructure Management (장비 CRUD + 라이프사이클)
- Digital Twin View (Room → Rack → Equipment)
- 알림 관리 (날짜별 접기, 카테고리 필터)
- 랙 시각화 (기본)
- 실시간 WebSocket 업데이트

### Phase 3: Advanced Features
- 랙 시각화 (고급 - 히트맵)
- 용량 계획
- 리포트 시스템

### Phase 4: Polish & Scale
- 다국어 (한국어/영어)
- 다크/라이트 모드 토글
- 성능 최적화
- E2E 테스트 (Playwright)
- 문서화

---

## 6. 배포

### Docker Compose 구성
```
docker-compose.yml
├── app (Next.js - multi-stage build, standalone output)
├── db (PostgreSQL 16 Alpine)
└── (Prometheus: 외부 - 10.144.38.100:30004)
```
