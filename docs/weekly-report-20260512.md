# 주간보고 (2026-05-05 ~ 2026-05-12)

## DCIM Management System 개발 현황

### 이번 주 요약
- 총 커밋: 30건
- 코드 변경: 47파일, +5,620줄 / -185줄 (앱 코드 기준)
- 주요 성과: BMC Redfish HW 정보 자동수집, 메모리 평가 시스템, BMC 센서 모니터링

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
- Ampere BMC 응답 구조 확인 (192.168.10.91 실측)
- ProcessorSummary fallback 적용: AmpereOne(R), 192코어
- ARM 서버 ThreadCount 미제공 → CoreCount 대체 로직

**전원 제어 진단 강화**
- BMC 응답 상세 진단 로그 추가
- 전원 버튼 상태 로직 개선 (On→끄기/재시작, Off→켜기)

### 2. 서버 호환성 검증

**Redfish 엔드포인트 호환성 매트릭스 완성**
- 5개 서버 타입 검증: SPR, GNR-AP, GNR-SP, Ampere, SRF
- 구형 Thermal/Power API: 전 모델 동작 확인
- ThermalSubsystem/PowerSubsystem: SPR·SRF 미지원 확인
- SRF 서버 정보 확인: Xeon 6780E (144c/144t)

**Lab-3 BMC 접근성 확인**
- Lab-1↔Lab-3 BMC IP 대역 충돌 확인 (192.168.10.x)
- 네트워크 분리 확인: 별도 스위치 사용으로 교차 접근 불가
- docs/system_info.md에 전체 서버 인벤토리 정리

### 3. 메모리 평가 관리 시스템 (신규 기능)

**평가 프로젝트 CRUD**
- FIELD / ACCELERATED 평가 타입 구분
- 메모리 스펙 기록: 제조사, 타입, 파트넘버, 용량, 속도
- 상태 관리: PLANNED → IN_PROGRESS → COMPLETED

**평가 상세 페이지**
- Overview: 단계(Phase) 관리 + 테스트 결과 테이블
- Timeline: Gantt 차트 스타일 타임라인 시각화
- Tasks: Kanban 스타일 태스크 관리 (TODO/IN_PROGRESS/DONE)
- Notes: 메모 기록

**DB 스키마**
- EvalProject, EvalPhase, EvalResult, EvalTask, EvalNote (5개 테이블)
- Prisma 스키마 추가 완료 (서버 DB push 필요)

### 4. 관리 기능

**BMC IP 매핑 관리**
- Settings > BMC 페이지에 IP 매핑 탭 추가
- 전체 장비 목록에서 BMC IP 인라인 편집
- 일괄 자동설정: Host IP 기반 BMC IP 자동 유도

**장비 관리 개선**
- 자동 등록 시 BMC IP 자동 유도 (Host IP 마지막 옥텟 활용)
- 수동 이력 기록 기능 추가

**기타 신규 페이지**
- 인벤토리 검색 페이지 (전체 장비 통합 검색)
- 펌웨어 관리 페이지 (펌웨어 버전 관리)

### 5. 인프라/버그 수정

- Next.js 동적 라우트 async params 대응 (12개 파일)
- Toast 컴포넌트 crypto.randomUUID 호환성 수정
- 로그인/로그아웃 화면 전환 개선 (애니메이션 + 깔끔한 리디렉트)
- node-exporter DaemonSet + Prometheus scrape config 작성 (배포 대기)

---

### 다음 주 계획

| 우선순위 | 작업 | 비고 |
|---------|------|------|
| 1 | 평가 DB 마이그레이션 (prisma db push) | 서버 작업 |
| 2 | 모델별 데이터 정합성 검증 (SPR, GNR-AP/SP, Ampere) | 스크립트 준비 완료 |
| 3 | 검증 결과 기반 UI 수정 | 누락/불일치 보정 |
| 4 | Host IP 수정 기능 검토 | 필요성 확인 |
| 5 | GPU 서버 대응 준비 | GPU 서버 도입 시 |
