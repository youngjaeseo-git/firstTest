# 설치 중 이슈 진단 & 대응 가이드

> 이 문서는 사내망 DCIM 설치 과정 중에 발견된 3가지 이슈에 대한 진단과 대응 방법을 정리한 것입니다.
>
> **발견된 상황 요약**
> 1. Prometheus `http://10.144.38.100:30004/api/v1/targets` 호출 시 404 Not Found
> 2. 사내 Harbor 레지스트리에 `postgres:16-alpine` 이미지 없음
> 3. BMC 도달성 확인 필요 (미확인 상태)

---

## 1. Prometheus 404 심화 진단

### 1.1 404가 의미하는 것

`/api/v1/targets`(복수형) 경로로 요청해도 404가 나온다면, **해당 주소가 Prometheus 본체가 아닐 가능성**이 높습니다. 네트워크 자체는 도달 가능하지만(TCP 연결 성공, 응답 수신), 경로가 존재하지 않는 상태예요.

주로 의심할 수 있는 원인:

- 리버스 프록시(nginx/traefik) 뒤에 Prometheus가 있고, 경로 접두어(`/prometheus/...`)가 붙어있음
- Kubernetes Ingress에서 다른 경로로 매핑됨
- 해당 포트가 Prometheus가 아닌 Grafana / AlertManager / Thanos 등 다른 서비스임

### 1.2 원인 추적 명령

대역폭을 거의 소비하지 않는 진단 명령들입니다. 순서대로 실행하고 **첫 몇 줄만** 확인하면 됩니다.

```bash
# (1) 루트 경로에 어떤 응답이 오는지 - HTML/JSON/에러 모두 단서가 됨
curl -s --max-time 5 http://10.144.38.100:30004/ | head -30

# (2) Prometheus 웹 UI 기본 경로
curl -sI --max-time 5 http://10.144.38.100:30004/graph

# (3) 경로 접두어 패턴 테스트
curl -sI --max-time 5 http://10.144.38.100:30004/prometheus/api/v1/targets
curl -sI --max-time 5 http://10.144.38.100:30004/api/prom/api/v1/targets

# (4) HEAD 요청 - 응답 헤더에서 서버 종류 단서 확보
curl -I --max-time 5 http://10.144.38.100:30004/

# (5) Grafana 여부 확인
curl -sI --max-time 5 http://10.144.38.100:30004/api/health
```

### 1.3 헤더 해석 가이드

특히 `(4)` HEAD 요청의 `Server:` 헤더가 가장 확정적인 단서입니다.

| 응답 헤더 | 해석 |
|-----------|------|
| `Server: nginx` | 리버스 프록시 뒤에 있음. 경로 접두어 찾아야 함 |
| `Server: Prometheus` 또는 헤더 없음 | Prometheus 본체 직접 응답 |
| `X-Grafana-*` 포함 | Grafana 서비스임. DCIM용 Prometheus는 아님 |
| `envoy` | 서비스 메시(Istio 등) 뒤에 있음 |

### 1.4 CLAUDE.md 와 실제가 다른 경우

`CLAUDE.md`의 "Confirmed Decisions" 섹션에 `Prometheus URL: http://10.144.38.100:30004`로 적혀있지만, 실제 경로가 다르면 다음 파일들을 업데이트해야 합니다.

- `CLAUDE.md` — 실제 URL로 수정
- `.env` 의 `PROMETHEUS_URL` — 실제 URL로 수정
- 접두어가 필요하면 `src/lib/prometheus.ts` 에서 baseUrl 처리 확인

---

## 2. postgres 이미지 전달 전략 (Harbor에 없음)

사내 Harbor 레지스트리에 `postgres:16-alpine` 이미지가 없는 것을 확인했으니, 3가지 방법 중 하나를 선택해야 합니다.

### 2.1 방법 A (권장): Mac/오피스 PC에서 tar 전달

가장 빠르게 오늘 안에 해결할 수 있는 방법입니다.

```bash
# 1단계: 인터넷 되는 PC에서 이미지 다운로드 및 저장
docker pull postgres:16-alpine
docker save postgres:16-alpine -o postgres-16-alpine.tar
# 파일 크기는 약 80MB

# 2단계: USB / Samba / SCP 등으로 사내 타깃 서버로 복사

# 3단계: 타깃 서버에서 로드
docker load -i postgres-16-alpine.tar
docker images | grep postgres
# 출력: postgres    16-alpine    xxxxxxxx    ...    80MB

# 4단계 (선택): Harbor에 push해서 팀원들도 사용 가능하게
docker tag postgres:16-alpine 10.144.36.119/library/postgres:16-alpine
docker login 10.144.36.119
docker push 10.144.36.119/library/postgres:16-alpine
```

### 2.2 방법 B: Harbor 프록시 캐시 설정 요청

Harbor에는 **Docker Hub 프록시 캐시** 기능이 있습니다. 관리자가 한 번만 설정해두면 이후에는 자동으로 Docker Hub 이미지를 프록시합니다.

- 사용 예: `docker pull 10.144.36.119/dockerhub-proxy/library/postgres:16-alpine`
- 장점: 팀 단위로 영구 해결, 향후 다른 이미지도 같은 방식으로 사용
- 단점: 관리자 협조 필요, 즉시 진행 불가

### 2.3 방법 C: Harbor 관리자에게 개별 요청

가장 단순한 방법이지만, 버전 변경 시마다 반복 요청이 필요합니다.

### 2.4 권장 선택

**오늘 즉시 진행하려면 방법 A**, **장기적으로는 방법 B**. 방법 A로 먼저 해결하고, 여유 있을 때 Harbor 관리자에게 방법 B를 요청하는 조합이 현실적입니다.

### 2.5 docker-compose.yml 수정 불필요

로컬에 `postgres:16-alpine` 태그가 있으면(방법 A의 `docker load` 후 상태), `docker-compose.yml`의 `image: postgres:16-alpine` 라인을 그대로 써도 됩니다. Docker는 pull 전에 먼저 로컬 이미지를 확인하고, 존재하면 네트워크 fetch 없이 바로 사용합니다.

Harbor에 push까지 완료했다면 `docker-compose.yml`을 아래처럼 바꿔도 됩니다.

```yaml
services:
  db:
    image: 10.144.36.119/library/postgres:16-alpine
```

이렇게 하면 다른 서버에 DCIM을 추가 배포할 때 Harbor에서 바로 pull할 수 있어요.

---

## 3. BMC 도달성 확인 (필수)

Redfish 기반 전원 제어 기능의 핵심이라 반드시 확인이 필요합니다.

### 3.1 확인 명령

실제 iDRAC/iLO IP 한 대를 골라서 실행하세요.

```bash
curl -k -v --max-time 5 https://<BMC_IP>/redfish/v1/ 2>&1 | head -20
```

`-k` 옵션은 자가서명 인증서를 무시하는 옵션으로, BMC 대상으로는 정상 사용 패턴입니다.

### 3.2 결과 해석

| 응답 | 의미 | 다음 단계 |
|------|------|-----------|
| `HTTP/1.1 401 Unauthorized` | 네트워크 OK, 인증만 필요 | 정상. 그대로 진행 |
| `HTTP/1.1 200 OK` + JSON | 네트워크 OK, 익명 접근 허용 | 정상. 그대로 진행 |
| `Connection refused` | 대상 호스트는 응답하지만 해당 포트 미개방 | BMC HTTPS 서비스 설정 확인 |
| `No route to host` | 네트워크 라우팅 문제 | 네트워크팀에 방화벽/라우팅 오픈 요청 |
| 타임아웃 | 방화벽 차단 가능성 높음 | 네트워크팀 티켓 필수 |

### 3.3 BMC IP를 모르는 경우

- 장비 대장(엑셀/CMDB)에서 iDRAC / iLO 주소 확인
- 가까이 있는 서버의 전면 LCD 패널에서 직접 조회
- 기존에 관리 중인 BMC 관리 도구가 있다면 거기서 한 대 선택

---

## 4. 현재까지 확인된 상태 요약

| 항목 | 상태 |
|------|------|
| OS (Ubuntu 20.04 + glibc 2.31) | ✅ OK |
| 아키텍처 (x86_64) | ✅ OK |
| Node.js 20.17.0 / npm 10.8.2 | ✅ 설치 완료 (`/root/opt/node-20/bin/node`) |
| Docker 20.10.12 | ✅ 설치되어 있음 (root 권한) |
| Docker Compose v2 | ⏳ 다운로드 중 (사내망 속도 제한으로 약 36분 소요) |
| 사내 Docker 레지스트리 (10.144.36.119) | ✅ Harbor 운영 중 |
| Prometheus 도달 | ⚠️ 경로 재확인 필요 (404) |
| postgres:16-alpine 이미지 | ⚠️ 방법 A로 수동 전달 필요 |
| BMC 도달 | ❓ 미확인 |

---

## 5. 다음 단계 우선순위

다운로드를 기다리는 동안 병렬로 진행 가능한 작업 순서:

1. **BMC 도달성 확인** (3.1) — 방화벽 문제가 있으면 네트워크팀 티켓이 가장 오래 걸리므로 최우선
2. **Prometheus 경로 추적** (1.2) — 헤더만 봐도 금방 원인 파악 가능
3. **Docker Compose 다운로드 완료 대기** — 기다리는 것 외에 할 일 없음
4. **postgres 이미지 tar 준비** (2.1) — Mac/오피스 PC에서 병렬 진행
5. **Docker Compose 설치 완료 후** → `npm install` 실행
6. **모든 점검 완료 후** → `docker compose up -d db` → Prisma migrate → 앱 기동

---

작성일: 2026-04-13
