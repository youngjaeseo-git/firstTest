# DCIM 프로젝트 월별 진행 및 계획

---

## 1. 프로젝트 전체 로드맵

```
Phase 1: 설계 및 핵심 구현      (2026년 4월 상순)     ✅ 완료
Phase 2: 사내 서버 배포          (2026년 4월 중순)     ✅ 완료
Phase 3: 데이터 정합성 검증      (2026년 4월 하순)     🔄 진행중
Phase 4: 운영 자동화 스크립트    (2026년 5월)          📋 예정
Phase 5: 고도화 및 확장          (2026년 6월~)         📋 예정
```

---

## 2. 월별 상세

### 2026년 4월 — 설계·구현·배포·검증

#### 1주차 (4/7~4/10): 핵심 기능 구현
- Next.js 14 + TypeScript + Tailwind 기반 프로젝트 구조 확립
- Prisma ORM + PostgreSQL 스키마 설계 (DataCenter → Room → Rack → Equipment)
- NextAuth.js 인증 (CredentialsProvider + JWT)
- 장비 CRUD (등록/수정/삭제/상세)
- CSV 대량 등록 (Bulk Import)
- Prometheus 연동 기초 (instantQuery, rangeQuery)

#### 2주차 (4/11~4/13): 기능 확장 및 UI 고도화
- Phase 1 Observability 메트릭 (CPU, Memory, Disk I/O, Network)
- 서버 비교 뷰 + CPU 코어 히트맵
- 글로벌 커맨드 팔레트 (⌘K)
- Digital Twin 뷰 (Room → Rack → Equipment)
- 한국어/영어 다국어 지원 (i18n)
- SSE 스트림 대시보드 (폴링 → 실시간)
- Redfish 전원 제어 + BMC 콘솔 링크
- 알림 관리 (날짜별 접기, 카테고리 필터)
- Vitest + Playwright 테스트 인프라 구축
- 사내 배포 가이드 3종 작성 (설치, 런타임, 트러블슈팅)

#### 3주차 (4/14~4/17): 사내 서버 배포
- Prisma 크로스 플랫폼 바이너리 설정 (darwin-arm64 ↔ debian-openssl)
- Mac → GitHub → 사무실PC → NFS → 리눅스 서버 파이프라인 확립
- PostgreSQL Docker + 앱 배포 성공 (포트 3000)
- Prometheus 실제 연결 확인 (K8s ClusterIP 10.100.175.248:8080)
- 메트릭 시스템 확정: node-exporter ❌ → Intel PCM ❌ → **cAdvisor** ✅
- 대시보드 fleet 쿼리 cAdvisor 변환
- server-start.sh 편의 스크립트 작성

#### 4주차 (4/18~4/20): 데이터 정합성 검증 (진행중)
- Prometheus Discovery 기능 완성 (동기화/등록/해제/검색/페이지네이션)
- IP 기반 PromQL 매칭으로 cross-job 메트릭 통합
- 장비 등록 시 CPU/메모리 Prometheus 자동 감지
- TypeScript 전체 타입 검증 통과 (에러 0개)
- Next.js 프로덕션 빌드 성공 확인

**4월 잔여 과제:**
- 시드 데이터 삭제 실행
- 실제 서버 등록 후 전체 메트릭 표시 검증
- 대시보드 fleet 수치 검증

---

### 2026년 5월 (예정) — 운영 자동화 및 안정화

#### 5월 목표: 서비스 무중단 운영 체계 구축

| 주차 | 항목 | 설명 |
|------|------|------|
| 1주 | **DCIM 서비스 자동화** | systemd 서비스 등록, 서버 재부팅 시 자동 시작, health check 모니터링 |
| 1주 | **DB 백업 자동화** | pg_dump 주기 실행 (cron), 백업 로테이션 (최근 7일 보관) |
| 2주 | **장애 복구 스크립트** | DB 복원, 앱 재시작, Docker 컨테이너 복구 원클릭 스크립트 |
| 2주 | **배포 파이프라인 자동화** | git pull → build → migrate → restart 전 과정 스크립트화 |
| 3주 | **K8s 서비스 관리 스크립트** | 모니터링 대상 서버들의 서비스 상태 점검, 이상 시 자동 알림/복구 |
| 3주 | **로그 관리** | 앱 로그 로테이션, Prometheus 데이터 보존 정책 설정 |
| 4주 | **종합 테스트 및 문서화** | 장애 시나리오별 복구 절차 매뉴얼, E2E 테스트 시나리오 작성 |

#### 5월 상세 계획

**1. DCIM 서비스 자동 시작/복구**
```
목적: 서버 재부팅, 프로세스 crash 등 accidental 상황에서 자동 복구
구현:
  - systemd service 파일 작성 (dcim-app.service, dcim-db.service)
  - Restart=always, WatchdogSec 설정으로 자동 재시작
  - health check 엔드포인트 (/api/health) 추가
  - 실패 시 관리자에게 알림 (이메일 또는 자체 알림)
```

**2. 데이터베이스 백업/복원 자동화**
```
목적: DB 손실, 마이그레이션 실패 등에 대한 안전망
구현:
  - backup.sh: pg_dump → gzip → /backup/dcim-YYYY-MM-DD.sql.gz
  - restore.sh: 백업 파일 선택 → 확인 → pg_restore
  - cron 등록: 매일 03:00 자동 백업
  - 7일 초과 백업 자동 삭제
```

**3. 장애 복구 통합 스크립트**
```
목적: 다양한 장애 상황에서 빠른 복구
구현:
  - recovery.sh: 상황별 복구 메뉴
    1) 앱 프로세스만 재시작
    2) DB 컨테이너 재시작 + 앱 재시작
    3) 전체 초기화 (DB 복원 + 마이그레이션 + 앱 시작)
    4) Prometheus 연결 진단
```

**4. 모니터링 대상 서버 서비스 관리 스크립트**
```
목적: DCIM이 관리하는 서버들의 서비스 상태를 자동으로 점검/복구
구현:
  - check-services.sh: 등록된 서버 목록 기반 SSH ping/health check
  - cAdvisor/kubelet 서비스 상태 확인
  - 서비스 다운 감지 시 자동 재시작 시도 + DCIM 알림 생성
  - Prometheus target health 기반 자동 장애 감지
```

---

### 2026년 6월~ (예정) — 고도화 및 확장

| 항목 | 설명 |
|------|------|
| 온도 데이터 연동 | 외부 SQL DB (PDU monitoring) 연결, Grafana 데이터소스 통합 |
| Multi-Prometheus | Room별 Prometheus URL 지원 (Lab1/Lab3 분리) |
| Audit Log 확장 | 전체 CRUD에 감사 로그 적용, /history 페이지 |
| BMC 자격증명 관리 | 장비별 BMC 계정 오버라이드, 비밀번호 로테이션 UI |
| Capacity Planning | 전력/공간/냉각 용량 예측 대시보드 |
| Reports PDF | 커스텀 리포트 생성 및 PDF 내보내기 |
| 프로덕션 빌드 최적화 | Docker 멀티스테이지 빌드, `npm run build && npm start` 전환 |

---

## 3. "자동화 스크립트"가 우리 프로젝트에서 의미하는 것

이전에 정리했던 내용은 크게 **두 가지 축**입니다:

### 축 1: DCIM 앱 자체의 운영 자동화
> "DCIM 서비스가 죽거나 서버가 재부팅되어도 자동으로 복구"

| 현재 상태 | 목표 |
|-----------|------|
| `server-start.sh` — 수동 실행 | systemd 서비스로 자동 시작/재시작 |
| `deploy-update.sh` — 수동 업데이트 | git hook + 스크립트로 원클릭 배포 |
| DB 백업 없음 | cron + pg_dump 자동 백업 |
| 장애 시 수동 진단 | recovery.sh 통합 복구 스크립트 |

### 축 2: 관리 대상 서버들의 서비스 자동화
> "모니터링 대상 서버들에 문제가 생겼을 때 빠르게 감지하고 대응"

| 현재 상태 | 목표 |
|-----------|------|
| Prometheus target UP/DOWN 확인 (수동) | 자동 health check + 알림 |
| 서비스 다운 시 수동 SSH 접속 | 스크립트로 원격 서비스 재시작 |
| K8s 노드 장애 시 수동 대응 | kubectl drain/uncordon 자동화 |
| BMC 접근 수동 | 스크립트로 일괄 BMC 상태 점검 |

이 두 가지가 Phase 4 (5월)의 핵심이며, DCIM 설계·구현 (Phase 1-2) → 서버 배포·데이터 검증 (Phase 3) → **운영 자동화 (Phase 4)** 순서로 진행됩니다.

---

## 4. 현재 위치 (2026-04-20 기준)

```
[✅ Phase 1] 설계 및 구현 ━━━━━━━━━━━━━━━━━━━━ 100%
[✅ Phase 2] 사내 서버 배포 ━━━━━━━━━━━━━━━━━━━ 100%
[🔄 Phase 3] 데이터 정합성 검증 ━━━━━━━━━━━━━━━ 70%
   ├ Discovery/Registration ✅
   ├ 메트릭 쿼리 변환 ✅
   ├ 실제 데이터 표시 검증 🔄
   └ 시드 데이터 정리 📋
[📋 Phase 4] 운영 자동화 ━━━━━━━━━━━━━━━━━━━━━ 0%
[📋 Phase 5] 고도화 ━━━━━━━━━━━━━━━━━━━━━━━━━━ 0%
```
