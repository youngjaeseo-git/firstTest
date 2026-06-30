# DC Express — DCIM (Data Center Infrastructure Management)

> 데이터센터 인프라 관리·Observability·자산 관리를 통합한 웹 애플리케이션.
> 기존 Grafana 기반 서버 모니터링을 대체한다. **v0.9 (릴리즈 후보)**

---

## 무엇인가

DC Express는 서버·랙·전력·온도 등 데이터센터 자원을 한 곳에서 관리·감시하는 사내 DCIM 시스템이다.

- **모니터링**: CPU/메모리/디스크/네트워크/온도/전력/PCIe, 서버 비교, 실시간(SSE)
- **자산 관리**: 장비 CRUD, 메모리(DIMM) 상세, 펌웨어, BMC 전원 제어, 라이프사이클
- **물리 시각화**: Digital Twin(평면도), 랙 배치도·열지도
- **알림**: 규칙 평가 엔진(5분 주기 cron), 이력, 채널/에스컬레이션, 유지보수 창
- **용량/리포트**: 전력·공간·냉각 용량, 12개월 예측, 리포트 출력
- **운영**: RBAC, 조직별 접근 제어, 감사 로그, DB 백업

물리 계층: **DataCenter → Room → Rack → U Position**. 다국어(한/영) 지원.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| UI/시각화 | shadcn/ui(Radix) · Recharts · D3 · SVG |
| 상태관리 | React Context + useState |
| Backend | Next.js API Routes + Prisma ORM |
| DB | PostgreSQL(자산/설정) + Prometheus(시계열) |
| 실시간 | SSE (Server-Sent Events) |
| 인증 | NextAuth.js (Credentials, JWT) |
| 배포 | systemd(앱) + Docker(DB) — 아래 참조 |

## ⚠️ 운영 배포 구조 (반드시 숙지)

운영은 **하이브리드**다. docker-compose로 앱 전체를 띄우지 **않는다.**

| 구성 | 실제 |
|------|------|
| **앱** | systemd 서비스 `dcim` → `scripts/service-start.sh` → `npm run dev`(또는 prod). 포트 3000 |
| **DB** | Docker `dcim-db`(postgres:16-alpine), 호스트 포트 **5433**, 볼륨 `firsttest_pgdata` |
| 호스트 postgres 12(:5432) | 운영과 **무관**한 별도 설치 |

- ❌ `docker compose up -d app` / `docker compose down -v` 금지 (DB 충돌·데이터 손실 위험)
- 재시작: env만 바뀌면 `systemctl restart dcim`, 코드 바뀌면 `sudo bash scripts/rebuild-prod.sh`
- 상세: **[docs/project-handover.md §3-1](docs/project-handover.md)**

## 빠른 시작 (개발)

```bash
npm install
npm run verify        # typecheck + lint + test (DB 불필요)
npm run dev           # 개발 서버 (localhost:3000)
```

> 폐쇄망 배포는 로컬 빌드 → 파일 복사 방식. **[docs/dcim_system_usage.md](docs/dcim_system_usage.md)** 참조.

## 검증

```bash
npm run verify        # typecheck + lint + test:run
npm run verify:full   # 위 + next build (DATABASE_URL 필요)
```

## 문서

- **[docs/INDEX.md](docs/INDEX.md)** — 📑 전체 문서 안내 지도 (어떤 문서를 언제 보는지)
- 시작점: [docs/project-handover.md](docs/project-handover.md) → [docs/features.md](docs/features.md)

## 라이선스 / 비고

사내 폐쇄망(air-gapped) 운영 전용. 외부 배포용 아님.
