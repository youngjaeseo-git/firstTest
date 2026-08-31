# DCIM 사내망 설치 가이드

> 이 문서는 DCIM(Data Center Infrastructure Management) 웹 애플리케이션을 사내망 서버에 처음 설치할 때 사전 점검해야 할 항목과 권장 배포 위치를 정리한 것입니다.

---

## 1. 배포 위치 선정 (먼저 결정 필요)

### 1.1 기본 원칙

DCIM은 서버들의 전원/상태를 관리하는 도구이기 때문에, **관리 대상이 되는 서버 위에 DCIM을 같이 올리는 것은 피해야 합니다**. 이유는 다음과 같습니다.

- DCIM이 감시하는 서버에 DCIM을 올리면, 해당 서버가 느려지거나 장애가 났을 때 DCIM도 함께 영향을 받아 관제가 불가능해집니다.
- Redfish를 통해 원격 재부팅 명령을 내릴 때 자기 자신을 재부팅하는 상황이 생길 수 있어, 세션이 끊기고 감사 로그 기록도 실패할 수 있습니다.

### 1.2 배포 우선순위

| 우선순위 | 위치 | 설명 |
|----------|------|------|
| 1순위 | **전용 관리/유틸리티 서버** (Jumpbox, Bastion, 사내 도구 서버) | 이미 운영 도구를 올려두는 곳. 가장 이상적. |
| 2순위 | **Prometheus가 이미 돌고 있는 서버** (`10.144.38.100`) | 이미 관리망 접근 권한이 있고 모니터링 성격이라 적합. 리소스 여유 확인 필요. |
| 3순위 | 여유 있는 일반 서버 한 대를 "관리 전용"으로 전환 | 차선책. |
| ❌ 회피 | DCIM이 감시할 운영 워크로드 서버 | 위의 자기모순 문제. |
| ❌ 회피 | 오피스 Windows PC | PC가 꺼지면 서비스도 꺼지므로 운영 불가. 개발/데모에만 한정. |

### 1.3 요구 사양

- CPU 2 core 이상
- 메모리 2 GB 이상 (Next.js + PostgreSQL 합산)
- 디스크 10 GB 이상 (Docker 이미지 + DB 데이터 + 로그)
- 네트워크: `10.144.38.100:30004` (Prometheus) 도달 가능 + BMC 관리망 도달 가능
- 사용 포트: `3001` (웹 UI), `5432` (내부 PostgreSQL)

---

## 2. 환경 점검 체크리스트 (배포 서버에 SSH 접속 후)

아래 4개 단계를 순서대로 진행해 주시고, 막히는 지점이 있으면 해당 결과를 공유해 주세요. 단계별로 필요한 대응이 달라집니다.

### 2.1 기본 런타임 설치 여부

```bash
node --version          # v20.x 이상이어야 함 (Next.js 14 요구사항)
npm --version
docker --version
docker compose version  # Docker Compose v2 확인
```

- 전부 정상 출력되면 다음 단계로 진행.
- Node가 없으면 사내 repo에서 설치하거나, 설치 파일을 별도로 전달받아 설치가 필요합니다.
- Docker가 없거나 사내 정책상 허용되지 않을 경우 대안(Podman, Rancher Desktop 등) 검토가 필요합니다.

### 2.2 네트워크 도달성 점검

DCIM이 동작하려면 아래 3개의 연결이 반드시 가능해야 합니다.

```bash
# (1) Prometheus 도달 확인 - 200 OK + JSON 응답이 나와야 합니다
curl -v http://10.144.38.100:30004/api/v1/targets

# (2) BMC 1대 도달 확인 - 실제 iDRAC/iLO IP 하나로 테스트
#     401(인증필요) 또는 200 응답이면 네트워크는 OK입니다
#     "connection refused" 또는 타임아웃이면 방화벽/라우팅 점검 필요
curl -k https://<BMC_IP>/redfish/v1/

# (3) npm registry 도달 확인 (사내 미러 사용 예정이라면 생략 가능)
curl -v https://registry.npmjs.org
```

이 중 **(2) BMC 도달 확인이 가장 중요**합니다. 앱 서버에서 BMC 관리망으로 HTTPS가 나가지 못하면 전원 제어 기능 전체를 쓸 수 없습니다. 이 경우 네트워크팀에 방화벽 오픈 요청이 선행되어야 합니다.

### 2.3 `.env` 파일 작성

프로젝트 루트에서 템플릿을 먼저 확인한 뒤, `.env` 파일을 새로 작성합니다.

```bash
cat .env.example
```

`.env` 내용 예시:

```env
DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="<아래 명령으로 생성한 랜덤 값>"
PROMETHEUS_URL="http://10.144.38.100:30004"

# BMC Redfish 자격 증명 (함대 전체 공유 방식)
BMC_USERNAME="root"         # Dell=root, HPE=Administrator
BMC_PASSWORD="<실제 비밀번호>"
```

`NEXTAUTH_SECRET` 생성 방법:

```bash
openssl rand -base64 32
```

### 2.4 패키지 설치

```bash
npm install
```

- 사내망이 외부 npm registry를 차단한 경우 `ECONNREFUSED registry.npmjs.org` 오류가 발생합니다.
- 이 경우 사내 npm 미러(Nexus/Verdaccio 등) 정보를 받아 프로젝트 루트의 `.npmrc`에 등록하거나, 개발용 PC에서 `node_modules`를 미리 받아 전달하는 방식(오프라인 번들)이 필요합니다.

---

## 3. 초기 기동 절차 (환경 점검이 모두 통과한 뒤)

```bash
# 1) 데이터베이스 컨테이너 기동
docker compose up -d db

# 2) Prisma 스키마 반영
npx prisma migrate deploy

# 3) 시드 데이터 투입 (초기 admin 계정 포함)
npx prisma db seed

# 4) 개발용 기동 (포트 3001)
./dev.sh
# 또는 운영용 빌드
npm run build && npm start
```

정상 기동 후 브라우저에서 `http://<서버IP>:3001` 접속 → 로그인 → Dashboard의 Prometheus 상태 인디케이터가 녹색인지 확인합니다.

---

## 4. 기능 검증 (설치 직후 실시)

1. **로그인** — 시드 계정(예: `admin@local`)으로 로그인이 되는가.
2. **Dashboard** — Prometheus 상태가 녹색, 메트릭 카드에 실제 수치가 표시되는가.
3. **Infrastructure** — 서버/랙/룸 목록이 조회되는가.
4. **Twin 뷰** — Room → Rack → Equipment 3단계 탐색과 브레드크럼이 정상 동작하는가.
5. **⌘K 검색** — 글로벌 검색 팔레트가 호스트명/알림을 찾아주는가.
6. **전원 제어(Redfish)** — 비중요 서버 한 대에서 GracefulRestart를 시도하고, 성공 시 `변경 이력` 탭에 POWER_ACTION 감사 로그가 남는지 확인.

위 6개 중 하나라도 실패하면 로그와 함께 공유 부탁드립니다.

---

## 5. 문제 발생 시 확인 지점

| 증상 | 확인할 곳 |
|------|-----------|
| 로그인 후 빈 화면 | `DATABASE_URL`, `NEXTAUTH_SECRET` 설정, 마이그레이션 반영 여부 |
| 대시보드 메트릭 안 나옴 | `PROMETHEUS_URL` 도달성, `/api/v1/targets` 응답 |
| 전원 제어 실패 | BMC 관리망 도달성, `BMC_USERNAME`/`BMC_PASSWORD`, Redfish 경로 |
| 감사 로그 미기록 | `AuditLog` 테이블 마이그레이션 여부(`npx prisma migrate status`) |

---

작성일: 2026-04-13
