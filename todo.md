# DCIM TODO (rev1 - 2026-04-12)

이 파일은 **아직 결정되지 않았거나 의도적으로 미뤄둔** 작업들의 목록입니다.
완료된 작업은 CLAUDE.md의 "Confirmed Decisions" 섹션이나 git log를 참고하세요.

---

## 1. 사내망 배포 (진행 중 — 결정 필요)

사내망(airgapped intranet)에 실제로 물건을 올릴 때 필요한 의사결정입니다.
내일 사무실 가서 확인해야 할 것들:

### 1.1 환경 확인 체크리스트 (오피스 도착 후)
- [ ] 타깃 서버 OS (Linux인지, 배포판·버전)
- [ ] Docker / Docker Compose 설치 여부 및 버전
- [ ] Node.js 20+ 설치 여부 (Next.js 14 요구사항)
- [ ] Prometheus `http://10.144.38.100:30004` 도달 가능 여부
- [ ] BMC 대표 1대(iDRAC/iLO) `https://<bmcIp>` 도달 가능 여부
- [ ] 사내 npm 미러/레지스트리 존재 여부 (Nexus, Verdaccio, Artifactory 중)
- [ ] 사내 Docker 레지스트리 존재 여부 (Harbor 등)
- [ ] 사내 git 서버 (GitLab/Gitea) 존재 여부
- [ ] Windows 오피스 PC → 타깃 Linux 서버 간 삼바/SSH 접근 가능성
- [ ] USB 사용 허가 정책

### 1.2 전송 방식 결정 (미결정)
**Option A**: Windows PC에서 `git clone` → 삼바 공유 → 타깃 서버 `cp`
- 장점: 소스 버전관리 깔끔
- 단점: `node_modules`(~500MB~1GB)와 Docker 이미지(`postgres:16-alpine` ~150MB)는 git으로 못 옮김 → 별도 번들 필요

**Option B**: Mac에서 미리 다 묶어서 USB 1개로 전달
- `source.tar.gz` (git archive)
- `node_modules.tar.gz` (미리 `npm install` 완료)
- `postgres-16-alpine.tar` (`docker save postgres:16-alpine`)
- `app-image.tar` (선택: `docker compose build` 후 `docker save`)

**Option C**: 사내 레지스트리 활용 (가장 깔끔, 가능하면 이것)
- 사내 npm 미러에서 `npm install`
- 사내 Docker 레지스트리에서 postgres pull
- 사내 git에서 clone

→ **결정 보류**: 1.1 체크리스트 결과에 따라 A/B/C 선택

### 1.3 초기 실행 순서 (전송 완료 후)
- [ ] `.env` 작성 (DATABASE_URL, NEXTAUTH_SECRET, BMC_USERNAME, BMC_PASSWORD, PROMETHEUS_URL)
- [ ] `docker load -i postgres-16-alpine.tar` (B안 선택 시)
- [ ] `docker compose up -d db`
- [ ] `npx prisma migrate deploy`
- [ ] `npx prisma db seed` (초기 admin 계정 확인)
- [ ] `npm run build && npm start` 또는 `./dev.sh`
- [ ] 로그인 → Dashboard → Prometheus 상태 녹색 확인
- [ ] 비핵심 서버 1대에서 Redfish `GracefulRestart` 실행 테스트 → AuditLog 기록 확인

---

## 2. Audit Log 커버리지 확장 (미착수)

현재 `logAudit()`는 구현되어 있지만 **Power Action 경로에만** 호출되고 있습니다.
일관성을 위해 아래 경로에도 적용 필요:
- [ ] `POST /api/equipment` (CREATE)
- [ ] `PUT /api/equipment/[id]` (UPDATE with `diffShallow`)
- [ ] `DELETE /api/equipment/[id]` (DELETE, reason 필수화 여부 결정 필요)
- [ ] `POST /api/equipment/bulk-import` (bulk CREATE, 각 row마다 감사로그?)
- [ ] `PATCH /api/equipment/[id]/status` (STATUS_CHANGE)
- [ ] `POST /api/equipment/[id]/move` (RACK_MOVE, 아직 엔드포인트 없음)

**결정 필요**:
- 대량 등록(bulk-import) 시 감사 로그를 row별로 남길 것인가, 배치로 1건만 남길 것인가?
- DELETE에서 reason을 필수로 강제할 것인가, optional로 둘 것인가?

---

## 3. 글로벌 `/history` 페이지 (미착수)

장비 상세 페이지의 "변경 이력" 탭만 있고, 전체 시스템 레벨 감사 로그 열람 페이지는 없음.

- [ ] `/history` 사이드바 메뉴 추가 (ADMIN 전용?)
- [ ] 날짜/유저/액션/엔티티 필터
- [ ] 날짜별 접기 그룹 (기존 AlertsHistory 패턴 재사용)
- [ ] CSV 내보내기

---

## 4. BMC 자격증명 관리 (최소 구현 상태)

현재: `.env`의 `BMC_USERNAME` / `BMC_PASSWORD`를 함대 전체가 공유
- [ ] **per-equipment override** — `getBmcCredentials(equipment)`가 이미 equipment를 인자로 받도록 설계되어 있음. Equipment 스키마에 `bmcUsername`/`bmcPasswordEncrypted` 필드 추가 후 오버라이드
- [ ] **비밀번호 로테이션 UX** — 관리자가 UI에서 갱신할 수 있는 설정 페이지
- [ ] **Vault 연동** (장기) — HashiCorp Vault / Kubernetes Secret 백엔드 어댑터

---

## 5. 개별 서버 터미널 접근 (방식 A 채택됨, 개선 여지)

현재: `PowerConsoleCard`에 `https://<bmcHost>` 링크만 (BMC 웹 콘솔 새 탭)
- [ ] 방식 B (SSH via ttyd/wetty) — 사내망에서만 동작하므로 필요성 재검토
- [ ] 방식 C (Websocket Serial-over-LAN) — 복잡도 높음, 실수요 확인 후 결정

→ **결정**: 당분간 방식 A 유지. 운영 피드백 후 재검토.

---

## 6. Memory Detail Page (HIGH PRIORITY - CLAUDE.md 명시)

CLAUDE.md에 HIGH PRIORITY로 표기되어 있지만 현재 상태 확인 필요:
- [ ] `/infrastructure/[id]/memory` 페이지 현황 점검
- [ ] DIMM 슬롯별 상세, 제조사, 타입, 속도, 채널 다이어그램 완성도 확인
- [ ] 부족한 부분 백로그화

---

## 7. 기타 미결정 / 백로그

- [ ] **다국어** — 한국어/영어 스위처 있음, 번역 누락된 키 검수 필요
- [ ] **WebSocket 실시간** — 현재 Dashboard는 SSE로 전환됨. 다른 페이지(Server detail, Alerts)에도 적용할지 결정
- [ ] **Capacity Planning** 페이지 — CLAUDE.md에 명시되어 있으나 진행도 확인 필요
- [ ] **Reports** 페이지 (PDF 내보내기) — 미착수로 추정
- [ ] **E2E 테스트** — Playwright 인프라는 있음 (`3c534b7`), 실제 시나리오 커버리지 확인 필요
- [ ] **prod Dockerfile 최적화** — 현재 `npm ci || npm install` fallback이 있음. 사내망 도입 후 `npm ci`만 사용하도록 강제할지

---

## 최근 완료 (참고용 — 2026-04-11 ~ 2026-04-12)

- `ded04f9` 글로벌 커맨드 팔레트(⌘K) + Twin 뷰 브레드크럼
- `32f3aa0` Redfish 전원 제어 + BMC 콘솔 링크 + 장비 변경 이력
- `4243001` Prometheus 상태 인디케이터 + 대시보드 에러 바운더리
- `aa7b83f` 한/영 i18n + 언어 스위처
- `a4069c8` 대시보드 SSE 스트림 (폴링 → 스트림)
- `3c534b7` Vitest + Playwright 셋업
