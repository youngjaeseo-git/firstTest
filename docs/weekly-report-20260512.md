# 주간보고 (2026-05-05 ~ 2026-05-12)

## DCIM Management System 개발 현황

### 이번 주 요약
- 총 커밋: 34건
- 코드 변경: 60파일, +7,343줄 / -216줄
- 주요 성과: BMC Redfish 연동 전 모델 호환, 메모리 평가 시스템, 서버 목록 UX 개선

---

### 1. BMC/Redfish 연동 강화

**Redfish HW 정보 자동수집 (신규)**
- 서버 등록 시 BMC에서 자동으로 CPU, Memory DIMM, NIC 정보 수집
- 서버 상세 페이지에서 "HW 새로고침" 버튼으로 수동 갱신 가능
- CPU: 소켓, 모델명, 코어/스레드, TDP, 아키텍처
- Memory: DIMM 슬롯별 용량, 타입, 제조사, 파트넘버, 속도
- Network: MAC, 링크상태, IP

**BMC 센서 실시간 모니터링 (신규)**
- 서버 상세 페이지에 온도/팬/전력 센서 카드 추가
- 페이지 진입 시 자동 로드, 수동 Refresh 지원
- 전력 소비량 게이지 바, 온도 임계값 컬러 표시, 팬 RPM 그리드

**Ampere 프로세서 파싱 개선**
- Ampere BMC 실제 응답 구조 확인 (192.168.10.91 실측)
- 문제: Ampere는 /Processors/cpu0 경로 사용, 표준 Model/TotalCores/TotalThreads 필드 미제공
- 해결: ProcessorSummary fallback 체인 구현 → AmpereOne(R), 192코어 정상 파싱
- ARM 서버 ThreadCount 미제공 → CoreCount 대체 로직 (ARM은 코어당 1스레드)

**전원 제어 진단 강화**
- BMC 응답 상세 진단 로그 추가
- 전원 버튼 상태 로직 개선 (On→끄기/재시작, Off→켜기)

### 2. 서버 호환성 검증

**Redfish 엔드포인트 호환성 매트릭스 완성**
- 5개 서버 타입 실측 검증: SPR, GNR-AP, GNR-SP, Ampere, SRF
- 구형 Thermal/Power API: **전 모델 동작 확인** → 현재 DCIM 구현 호환
- ThermalSubsystem/PowerSubsystem: SPR·SRF 미지원 (404), GNR/Ampere 지원
- SRF 서버 정보 확인: Xeon 6780E (144코어/144스레드), 메모리 2 DIMM (세팅 중)
- Ampere: PowerConsumedWatts = None (전력 소비량 미제공), Processor 파싱 보완 완료

**Lab-3 BMC 접근성 확인**
- Lab-1↔Lab-3 BMC IP 대역 충돌 확인 (192.168.10.x 동일 대역)
- 네트워크 분리 확인: 별도 스위치 사용으로 교차 접근 불가
- Lab-3 BMC 모니터링은 Lab-3 마스터에 프록시 구성 필요 (향후 과제)
- docs/system_info.md에 전체 서버 인벤토리·충돌 범위·Redfish 매트릭스 정리

**데이터 정합성 검증 스크립트 작성**
- BMC Redfish + Prometheus 전체 정보를 한번에 조회하는 통합 스크립트 완성
- DCIM UI 화면 섹션 순서와 동일하게 출력 (System Info → CPU → Memory → Network → Sensors → Prometheus)
- 모델별 1대씩 실행하여 UI와 비교 예정 (다음 주)

### 3. 메모리 평가 관리 시스템 (신규 기능)

**평가 프로젝트 CRUD**
- FIELD / ACCELERATED 평가 타입 구분
- 메모리 스펙 기록: 제조사, 타입, 파트넘버, 용량, 속도
- 상태 관리: PLANNED → IN_PROGRESS → ON_HOLD → COMPLETED → CANCELLED

**평가 상세 페이지 (4개 탭)**
- Overview: 단계(Phase) 관리 + 테스트 결과 테이블
- Timeline: Gantt 차트 스타일 타임라인 시각화 (Phase 바, Result 마커, 오늘 표시선)
- Tasks: Kanban 스타일 태스크 관리 (TODO/IN_PROGRESS/BLOCKED/DONE)
- Notes: 메모 기록/삭제

**DB 스키마**
- EvalProject, EvalPhase, EvalResult, EvalTask, EvalNote (5개 테이블)
- Prisma 스키마 추가 완료 (서버 DB push 필요)

### 4. 서버 목록 UX 개선

**필터/정렬 기능 추가**
- 콤보박스 필터 3개: Model (서버 모델), Status (상태), Room (서버룸)
- 테이블 컬럼 정렬: Hostname, IP, Status, System Model 클릭 시 오름차순/내림차순 토글
- 현재 정렬 기준 컬럼 파란색 하이라이트 (▲/▼ 방향 표시)
- 필터 활성 시 "초기화" 버튼 표시 (활성 필터 수 표시)
- 기존 텍스트 검색과 동시 사용 가능

### 5. 관리 기능

**BMC IP 매핑 관리**
- Settings > BMC 페이지에 IP 매핑 탭 추가
- 전체 장비 목록에서 BMC IP 인라인 편집 (펜슬 아이콘 → Enter 저장)
- 일괄 자동설정: Host IP 기반 BMC IP 자동 유도
- 장비 수정 페이지에서도 BMC IP 편집 가능 (두 곳에서 수정 가능)

**장비 관리 개선**
- 자동 등록 시 BMC IP 자동 유도 (Host IP 마지막 옥텟 활용)
- 수동 이력 기록 기능 추가

**기타 신규 페이지**
- 인벤토리 검색 페이지 (전체 장비 통합 검색)
- 펌웨어 관리 페이지 (펌웨어 버전 관리)

### 6. 인프라/버그 수정

- Next.js 동적 라우트 async params 대응 (12개 파일)
- Toast 컴포넌트 crypto.randomUUID 호환성 수정
- 로그인/로그아웃 화면 전환 개선 (애니메이션 + 깔끔한 리디렉트)
- node-exporter DaemonSet + Prometheus scrape config 작성 (배포 대기)
- 불필요한 import/상수 정리

---

### 다음 주 계획

| 우선순위 | 작업 | 상태 |
|---------|------|------|
| 1 | 평가 DB 마이그레이션 (prisma db push) | 서버 작업 필요 |
| 2 | 모델별 데이터 정합성 검증 (SPR, GNR-AP/SP, Ampere) | 스크립트 준비 완료, 실행 대기 |
| 3 | 검증 결과 기반 UI/파싱 수정 | 검증 후 진행 |
| 4 | Host IP 수정 기능 검토 | 필요성 확인 |
| 5 | GPU 서버 대응 준비 | GPU 서버 도입 시 (로드맵 작성 완료) |

### 이슈/참고사항

| 항목 | 내용 |
|------|------|
| Lab-3 BMC | Lab-1에서 접근 불가 (별도 스위치). Lab-3 마스터에 프록시 필요 |
| Ampere 전력 | BMC에서 PowerConsumedWatts = None 반환. 전력 모니터링 불가 |
| SRF 서버 | 현재 부팅 불가 (세팅 중). 검증 대상에서 제외 |
| 평가 기능 | DB push 전까지 500 에러 발생. 마이그레이션 우선 필요 |
