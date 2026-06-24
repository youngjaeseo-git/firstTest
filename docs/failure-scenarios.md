# DCIM 장애 시나리오 대응 매뉴얼

> DCIM 시스템 운영 중 발생할 수 있는 장애 유형별 증상, 원인, 진단, 복구, 예방 절차를 정리한 운영 매뉴얼이다.
> 모든 절차는 **폐쇄망(air-gapped) 환경**을 전제로 하며, 외부 다운로드 없이 로컬에서 해결 가능한 방법만 기술한다.

---

## 목차

1. [앱 서버 다운 (Next.js 프로세스 죽음)](#1-앱-서버-다운)
2. [DB 컨테이너 장애](#2-db-컨테이너-장애)
3. [DB 데이터 손상/삭제](#3-db-데이터-손상삭제)
4. [Prometheus 연결 불가](#4-prometheus-연결-불가)
5. [디스크 용량 부족](#5-디스크-용량-부족)
6. [인증/세션 문제](#6-인증세션-문제)
7. [Prisma 마이그레이션 실패](#7-prisma-마이그레이션-실패)
8. [Docker 전체 장애](#8-docker-전체-장애)
9. [Lab-3 Prometheus 연결 불가](#9-lab-3-prometheus-연결-불가)
10. [BMC 접근 불가](#10-bmc-접근-불가)
11. [OOM (Out of Memory)](#11-oom-out-of-memory--nextjs--nodejs-메모리-초과)
12. [Prisma Connection Pool 고갈](#12-prisma-connection-pool-고갈--db-커넥션-풀-부족)
13. [SSE/WebSocket 스트림 누적](#13-ssewebsocket-스트림-누적--클라이언트-연결-과다로-서버-자원-소진)
14. [환경변수 설정 오류](#14-환경변수-설정-오류--env-파일-누락변경으로-앱-시작-실패)
15. [Docker Network 장애](#15-docker-network-장애--컨테이너-간-통신-불가)
16. [PostgreSQL Volume 손상](#16-postgresql-volume-손상--docker-볼륨-파손으로-db-시작-불가)
17. [BMC 프록시 장애](#17-bmc-프록시-장애--lab-3-bmc-접근-프록시-서버-장애)
18. [Multi-Prometheus 부분 장애](#18-multi-prometheus-부분-장애--lab-1-정상-lab-3-타겟-일부-down)
19. [NextAuth 인증 장애](#19-nextauth-인증-장애--jwt-시크릿-변경세션-만료-대량-발생)
20. [Next.js Build 실패](#20-nextjs-build-실패--배포-시-빌드-실패)

---

## 공통 사항

- **복구 스크립트**: `./scripts/recovery.sh` — 메뉴 기반 복구 도구
  - 옵션 1: 앱 서버만 재시작
  - 옵션 2: DB 컨테이너 재시작
  - 옵션 3: 전체 재시작 (DB + 마이그레이션 + 앱)
  - 옵션 4: 백업에서 DB 복원
  - 옵션 5: 최근 에러 로그 확인
  - 옵션 6: 시스템 상태 확인
- **앱 로그 위치**: `/tmp/dcim-app.log`
- **DB 백업 위치**: `$HOME/dcim-backups/`
- **Docker 서비스**: `dcim-db` (PostgreSQL 16), `dcim-app` (Next.js)
- **DCIM 앱 주소**: `http://10.144.38.100:3000`
- **Prometheus ClusterIP**: `http://10.100.175.248:8080`

---

## 1. 앱 서버 다운

Next.js 프로세스가 비정상 종료되어 웹 서비스가 중단된 경우.

### 증상

- 브라우저에서 `http://10.144.38.100:3000` 접속 시 **연결 거부** 또는 **502 에러**
- API 호출 시 응답 없음 (timeout)
- 모니터링 대시보드, 장비 관리 등 모든 페이지 접근 불가

### 원인

- Node.js 프로세스 OOM (메모리 부족)으로 kill
- 처리되지 않은 예외(unhandled exception)로 크래시
- 시스템 재부팅 후 앱 미시작
- 포트 충돌 (3000번 포트를 다른 프로세스가 점유)

### 진단

```bash
# 프로세스 확인
pgrep -f "next dev"

# 포트 사용 확인
ss -tlnp | grep 3000

# 최근 로그 확인 (크래시 원인)
tail -50 /tmp/dcim-app.log

# 시스템 메모리 확인
free -h

# OOM kill 확인
dmesg | grep -i "oom\|killed" | tail -5
```

### 복구 절차

**방법 1: recovery.sh 사용 (권장)**

```bash
./scripts/recovery.sh
# 메뉴에서 1 선택 (앱 서버만 재시작)
```

recovery.sh 옵션 1은 다음을 수행한다:
1. 기존 `next dev` 프로세스 종료 (`pkill -f "next dev"`)
2. DB 컨테이너에서 연결 정보 자동 구성
3. `nohup npm run dev -- -p 3000` 으로 백그라운드 시작
4. 로그 출력 위치: `/tmp/dcim-app.log`

**방법 2: 수동 재시작**

```bash
# 기존 프로세스 종료
pkill -f "next dev"

# DB 포트 확인
docker compose port db 5432

# 환경변수 설정 후 시작
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"
nohup npm run dev -- -p 3000 > /tmp/dcim-app.log 2>&1 &
```

**포트 충돌인 경우:**

```bash
# 3000번 포트 점유 프로세스 확인
ss -tlnp | grep 3000

# 해당 프로세스 종료 후 앱 재시작
kill -9 <점유 PID>
```

### 예방

- `./scripts/setup-logrotate.sh` 실행으로 로그 로테이션 설정 (50MB 초과 또는 매일 자동 로테이션)
- `dmesg` 로그에 OOM이 반복되면 Node.js 메모리 제한 상향 검토
- 시스템 재부팅 시 자동 시작 스크립트 등록 고려

---

## 2. DB 컨테이너 장애

PostgreSQL Docker 컨테이너(`dcim-db`)가 중지되거나 비정상 상태인 경우.

### 증상

- 페이지 로딩 시 **빈 화면** 또는 **로딩 스피너 무한 회전**
- API 호출 시 **500 Internal Server Error** 응답
- 앱 로그에 `ECONNREFUSED`, `Connection refused`, `P1001` (Prisma 연결 실패) 에러
- 장비 목록, 사용자 정보 등 DB 의존 데이터 전부 미표시

### 원인

- Docker 데몬 재시작으로 컨테이너 중지
- 디스크 공간 부족으로 PostgreSQL 프로세스 종료
- `docker compose down` 실수 실행
- 컨테이너 healthcheck 실패 반복 (PostgreSQL 내부 장애)

### 진단

```bash
# 컨테이너 상태 확인
docker compose ps db

# healthcheck 상태 상세
docker inspect dcim-db --format '{{.State.Health.Status}}'

# DB 로그 확인
docker compose logs db --tail=30

# DB 연결 테스트
docker exec dcim-db pg_isready -U dcim -d dcim

# 테이블 존재 확인
docker exec dcim-db psql -U dcim -d dcim -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
```

### 복구 절차

**경증: 컨테이너 재시작으로 해결**

```bash
./scripts/recovery.sh
# 메뉴에서 2 선택 (DB 컨테이너 재시작)
```

recovery.sh 옵션 2는 `docker compose restart db` 실행 후 최대 30초간 healthy 상태 대기한다.

**중증: DB 재시작 후에도 unhealthy**

```bash
./scripts/recovery.sh
# 메뉴에서 3 선택 (전체 재시작)
```

recovery.sh 옵션 3은 다음을 수행한다:
1. 앱 종료
2. DB 컨테이너 재시작 + healthy 대기
3. `prisma migrate deploy` 실행 (마이그레이션 적용)
4. `prisma generate` 실행
5. 앱 재시작

**컨테이너가 완전히 사라진 경우:**

```bash
docker compose up -d db

# healthy 대기 후 앱 재시작
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- DB 백업 cron 등록: `./scripts/backup-db.sh --install` (매일 03:00 자동 백업)
- Docker 볼륨(`pgdata`)이 마운트된 디스크 용량 주기적 확인
- `docker compose down` 시 `-v` 플래그 절대 사용 금지 (볼륨 삭제됨)

---

## 3. DB 데이터 손상/삭제

DB 내 데이터가 손상되거나 실수로 삭제된 경우.

### 증상

- 특정 장비/사용자 데이터가 **갑자기 사라짐**
- 앱 로그에 `relation "TableName" does not exist` 에러
- API 응답에 `Prisma error: The table does not exist` 류 에러
- 일부 페이지만 500 에러 (손상된 테이블을 참조하는 페이지)

### 원인

- 수동 SQL 실행 중 실수 (DROP, DELETE, TRUNCATE)
- `docker compose down -v` 실행으로 볼륨 삭제
- `prisma migrate reset` 실수 실행 (전체 초기화)
- 디스크 장애로 데이터 파일 손상

### 진단

```bash
# 테이블 목록 확인
docker exec dcim-db psql -U dcim -d dcim -c "\dt"

# 특정 테이블 레코드 수 확인
docker exec dcim-db psql -U dcim -d dcim -c "SELECT count(*) FROM \"Equipment\""

# 백업 목록 확인
./scripts/backup-db.sh --list
```

### 복구 절차

**방법 1: recovery.sh에서 백업 복원**

```bash
./scripts/recovery.sh
# 메뉴에서 4 선택 (백업에서 DB 복원)
```

recovery.sh 옵션 4는 `backup-db.sh --restore`를 호출한다. 이 과정에서:
1. 기존 백업 목록을 표시
2. 최신 백업 파일을 선택
3. 복원 전 **현재 DB 상태를 자동 백업** (`dcim-pre-restore-*.sql.gz`)
4. `yes` 입력 시 복원 실행

**방법 2: 특정 백업 파일 지정 복원**

```bash
# 백업 목록 확인
./scripts/backup-db.sh --list

# 특정 백업으로 복원
./scripts/backup-db.sh --restore $HOME/dcim-backups/dcim-20260623-030000.sql.gz
```

**방법 3: 테이블 구조만 손상된 경우 (데이터 볼륨은 정상)**

```bash
# 스키마 재적용
npx prisma db push
```

**복원 후 앱 재시작 필수:**

```bash
./scripts/recovery.sh
# 메뉴에서 1 선택 (앱 재시작)
```

### 예방

- `./scripts/backup-db.sh --install`로 cron 자동 백업 활성화 (매일 03:00, 7일 보관)
- 수동 SQL 실행 전 반드시 `./scripts/backup-db.sh` 로 수동 백업 먼저 수행
- `docker compose down -v`는 **개발 환경에서만** 사용, 운영에서는 절대 금지
- `prisma migrate reset`은 운영에서 절대 사용 금지

---

## 4. Prometheus 연결 불가

DCIM 앱에서 Prometheus 서버로의 연결이 실패하는 경우.

### 증상

- 대시보드에서 **메트릭 수치가 빈 상태** (0이 아닌 빈 값)
- 차트 영역 **로딩 실패** 또는 "데이터 없음" 표시
- 서버 상세 페이지에서 CPU, 메모리, 온도 등 실시간 데이터 미표시
- 앱 로그에 `ECONNREFUSED 10.100.175.248:8080` 또는 timeout 에러
- **UI 자체는 깨지지 않음** — 에러 바운더리가 동작하여 메트릭 영역만 비어있고 나머지 기능(자산 관리, 인증 등)은 정상

### 원인

- Prometheus Pod 크래시 또는 재시작 중
- K8s 네트워크 정책 변경으로 ClusterIP 접근 차단
- Prometheus 서비스(`prometheus-service`, namespace: monitoring) 삭제 또는 변경
- DCIM 앱 환경변수 `PROMETHEUS_URL` 설정 오류

### 진단

```bash
# DCIM 앱에서 Prometheus 직접 연결 테스트
curl -s --connect-timeout 5 "http://10.100.175.248:8080/-/healthy"

# NodePort로 외부 접근 테스트
curl -s --connect-timeout 5 "http://10.144.38.100:30003/-/healthy"

# Prometheus 타겟 상태 확인 (연결 가능할 때)
curl -s "http://10.100.175.248:8080/api/v1/targets" | head -100

# K8s에서 Pod 상태 확인 (k8-master에서)
kubectl get pods -n monitoring

# Prometheus 서비스 확인
kubectl get svc -n monitoring
```

### 복구 절차

**Prometheus Pod 재시작:**

```bash
# k8-master (10.144.38.100) 에서 실행
kubectl rollout restart deployment prometheus-deployment -n monitoring

# Pod 상태 확인
kubectl get pods -n monitoring -w
```

**서비스 정상인데 앱에서 연결 안 될 때:**

```bash
# 앱의 환경변수 확인
# docker-compose.yml에서 PROMETHEUS_URL 값 확인
# 기본값: http://10.144.38.100:30004 (docker-compose 기본)
# 실제 사용: http://10.100.175.248:8080 (ClusterIP, 앱이 같은 노드에서 실행 시)

# 앱 재시작 (환경변수 재적용)
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- Prometheus 연결 불가 시에도 DCIM 앱의 자산 관리, 인증 등 DB 기반 기능은 정상 동작
- 에러 바운더리가 메트릭 영역의 장애를 격리하므로 전체 UI 크래시는 발생하지 않음
- Prometheus Pod의 resource limit 적절히 설정하여 OOM 방지

---

## 5. 디스크 용량 부족

호스트 또는 Docker 볼륨의 디스크 공간이 부족한 경우.

### 증상

- DB 쓰기 실패 — 장비 등록, 설정 변경 등 저장 안 됨
- 앱 로그 기록 중단 (`/tmp/dcim-app.log` 크기 멈춤)
- Docker 컨테이너 시작 실패
- 앱 로그에 `ENOSPC`, `No space left on device` 에러

### 원인

- 앱 로그(`/tmp/dcim-app.log`) 비대 — 로그 로테이션 미설정 시 무한 증가
- Docker 이미지/빌드 캐시 누적
- DB 백업 파일 누적 (`$HOME/dcim-backups/`)
- PostgreSQL WAL 로그 누적

### 진단

```bash
# 전체 디스크 사용량
df -h

# 큰 파일 찾기
du -sh /tmp/dcim-app.log
du -sh $HOME/dcim-backups/
du -sh /var/lib/docker/

# Docker 디스크 사용량 상세
docker system df
```

### 복구 절차

**1단계: 앱 로그 정리**

```bash
# 현재 로그 크기 확인
du -h /tmp/dcim-app.log

# 로그 즉시 로테이션 (setup-logrotate 설정된 경우)
./scripts/setup-logrotate.sh --rotate

# 설정 안 된 경우 수동 truncate
: > /tmp/dcim-app.log
```

**2단계: 오래된 백업 정리**

```bash
# 백업 목록 확인
./scripts/backup-db.sh --list

# 수동 정리 (7일 초과 파일 삭제)
find $HOME/dcim-backups -name "dcim-*.sql.gz" -mtime +7 -delete
```

**3단계: Docker 정리**

```bash
# 사용하지 않는 이미지, 빌드 캐시 정리
docker system prune -f

# 더 적극적 정리 (미사용 볼륨 제외)
docker image prune -a -f
docker builder prune -f
```

**4단계: 정리 후 서비스 확인**

```bash
./scripts/recovery.sh
# 메뉴에서 6 선택 (시스템 상태 확인)
```

### 예방

- 로그 로테이션 설정: `./scripts/setup-logrotate.sh` (매일 04:00 자동 로테이션, 50MB 초과 시 즉시, 7일 보관)
- DB 백업 자동 정리: `backup-db.sh`는 기본 7일(`KEEP_DAYS=7`) 초과 백업을 자동 삭제
- `df -h` 주기적 점검, 80% 이상 시 조치

---

## 6. 인증/세션 문제

로그인 실패, 세션 만료, 인증 관련 장애.

### 증상

- 로그인 페이지에서 **올바른 자격 증명으로도 로그인 실패**
- 로그인 후 즉시 **세션 만료**로 다시 로그인 페이지로 이동
- API 호출 시 **401 Unauthorized** 응답
- 앱 로그에 `JWT`, `NEXTAUTH`, `session` 관련 에러

### 원인

- `NEXTAUTH_SECRET` 환경변수 변경 — 기존 JWT 토큰이 모두 무효화
- `NEXTAUTH_URL` 환경변수와 실제 접속 URL 불일치
- 서버 시간 불일치 (JWT 만료 검증 실패)
- 앱 재시작 시 환경변수 누락

### 진단

```bash
# 앱 프로세스의 환경변수 확인
cat /proc/$(pgrep -f "next dev" | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep -E "NEXTAUTH|DATABASE"

# docker-compose.yml의 기본값 확인
# NEXTAUTH_SECRET: change-me-in-production
# NEXTAUTH_URL: http://localhost:3000

# 서버 시간 확인
date

# DB에서 사용자 존재 확인
docker exec dcim-db psql -U dcim -d dcim -c "SELECT id, email, name FROM \"User\" LIMIT 5"
```

### 복구 절차

**환경변수 확인 후 앱 재시작:**

```bash
# 환경변수가 올바르게 설정되었는지 확인 후
./scripts/recovery.sh
# 메뉴에서 1 선택 (앱 재시작)
```

recovery.sh 옵션 1은 DB 컨테이너에서 자동으로 `DATABASE_URL`을 구성한다. 추가로 `NEXTAUTH_SECRET`과 `NEXTAUTH_URL`이 필요하면 앱 시작 전에 export 한다.

**사용자 계정 문제인 경우:**

```bash
# DB에 사용자 존재 확인
docker exec dcim-db psql -U dcim -d dcim -c "SELECT id, email FROM \"User\""

# 비밀번호 재설정이 필요하면 DB 직접 수정 또는 시드 스크립트 재실행
npx prisma db seed
```

### 예방

- `NEXTAUTH_SECRET` 값을 변경할 때는 **모든 사용자에게 재로그인 필요**를 사전 공지
- `NEXTAUTH_URL`은 실제 접속하는 URL(`http://10.144.38.100:3000`)과 일치시킬 것
- 서버 NTP 동기화 확인 (폐쇄망이므로 내부 NTP 서버 사용)

---

## 7. Prisma 마이그레이션 실패

앱 시작 시 DB 스키마와 Prisma 스키마가 불일치하는 경우.

### 증상

- 앱 시작 시 **Prisma 관련 에러**로 크래시
- `The database schema is not empty` 에러
- `Migration failed` 에러
- 새로 추가된 기능의 테이블/컬럼이 DB에 없어서 500 에러

### 원인

- 코드 업데이트 후 `prisma migrate deploy` 또는 `prisma db push` 미실행
- 마이그레이션 파일과 실제 DB 상태 불일치
- 수동 SQL로 스키마를 변경하여 Prisma 추적과 어긋남

### 진단

```bash
# 현재 DB 스키마와 Prisma 스키마 비교
npx prisma migrate status

# DB 테이블 목록 직접 확인
docker exec dcim-db psql -U dcim -d dcim -c "\dt"

# 마이그레이션 히스토리 확인
docker exec dcim-db psql -U dcim -d dcim -c "SELECT * FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 5"
```

### 복구 절차

**방법 1: 마이그레이션 적용 (일반적인 경우)**

```bash
# 환경변수 설정
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"

# 마이그레이션 적용
npx prisma migrate deploy
npx prisma generate
```

**방법 2: 스키마 강제 동기화 (마이그레이션 히스토리가 꼬인 경우)**

```bash
# 주의: 데이터를 보존하면서 스키마만 동기화
npx prisma db push
npx prisma generate
```

**방법 3: recovery.sh 전체 재시작 (마이그레이션 포함)**

```bash
./scripts/recovery.sh
# 메뉴에서 3 선택 (전체 재시작)
```

recovery.sh 옵션 3은 DB 재시작 후 `prisma migrate deploy` + `prisma generate`를 자동 실행한 뒤 앱을 시작한다.

### 예방

- 코드 업데이트(파일 복사) 후 `prisma migrate deploy` 실행을 절차에 포함
- `prisma db push`는 개발 편의용, 운영에서는 `prisma migrate deploy` 권장
- 수동 SQL로 스키마를 직접 변경하지 않기 — 항상 Prisma 스키마를 통해 변경

---

## 8. Docker 전체 장애

Docker 데몬 자체가 중지되어 모든 컨테이너가 다운된 경우.

### 증상

- **모든 서비스 동시 다운** — 웹 접속 불가 + DB 연결 불가
- `docker` 명령어 실행 시 `Cannot connect to the Docker daemon` 에러
- `recovery.sh` 실행 시 시스템 상태에서 Docker: 중지됨 표시

### 원인

- Docker 데몬 크래시
- 시스템 재부팅 후 Docker 서비스 미시작
- Docker 소켓 파일 손상
- 커널 업데이트 후 Docker 호환성 문제

### 진단

```bash
# Docker 데몬 상태
systemctl status docker

# Docker 데몬 로그
journalctl -u docker --no-pager --since "1 hour ago" | tail -30

# Docker 소켓 확인
ls -la /var/run/docker.sock
```

### 복구 절차

**1단계: Docker 데몬 시작**

```bash
sudo systemctl start docker
sudo systemctl enable docker

# 시작 확인
docker info
```

**2단계: 컨테이너 시작**

```bash
docker compose up -d

# DB healthy 대기 (healthcheck: interval 5s, retries 5)
docker compose ps
```

**3단계: 앱 시작**

```bash
./scripts/recovery.sh
# 메뉴에서 1 선택 (앱 재시작)

# 또는 전체 재시작 (마이그레이션 포함)
# 메뉴에서 3 선택
```

### 예방

- `sudo systemctl enable docker` 로 시스템 부팅 시 자동 시작 설정
- Docker 데몬 로그 주기적 확인
- 커널 업데이트 시 Docker 호환성 사전 확인 (폐쇄망이므로 업데이트 빈도 낮음)

---

## 9. Lab-3 Prometheus 연결 불가

Lab-3(10.144.131.x) 클러스터의 메트릭 수집이 불가능한 경우.

### 증상

- 워크로드 페이지에서 **Lab-3 Pod 미표시**
- "Lab-3 데이터 불가" 배너 또는 경고 표시
- Lab-3 서버들(GNR-AP, GNR-SP, SRF)의 메트릭이 대시보드에서 빠짐
- **나머지 Lab-1 데이터는 정상** 표시

### 원인

- Lab-1 → Lab-3 네트워크 차단 (방화벽, K8s 네트워크 정책)
- Lab-3 Prometheus Pod가 비기능 상태 (K8s API 10.96.0.1:443 접근 불가, `i/o timeout` 반복)
- Lab-3 node-exporter가 Lab-1 Prometheus에서 수집 안 됨

### 진단

```bash
# Lab-1에서 Lab-3 Prometheus 접근 테스트
curl -s --connect-timeout 5 "http://10.144.131.100:30003/-/healthy"

# Lab-3 node-exporter 타겟 상태 (Lab-1 Prometheus에서 조회)
curl -s "http://10.100.175.248:8080/api/v1/targets" | grep -c "131\."

# Lab-3 PCM 메트릭 수집 상태
curl -s "http://10.100.175.248:8080/api/v1/query?query=up{job=~'AE-SMC-GNRAP_PCM|AE-SMC-GNRSP_PCM'}" | head -50
```

### 복구 절차

Lab-3 Prometheus 자체의 문제는 현재 알려진 이슈이다 (K8s API 접근 불가로 타겟 0개 상태).

**Lab-3 메트릭 수집 경로:**

Lab-3 서버 메트릭은 Lab-3 자체 Prometheus가 아닌 **Lab-1 Prometheus에서 직접 수집**한다:
- **node-exporter(:9100)**: Lab-1 Prometheus config에 Lab-3 17대 추가 완료 (2026-06-15)
- **PCM 메트릭**: `AE-SMC-GNRAP_PCM`, `AE-SMC-GNRSP_PCM` job에서 hostname 기반 수집

**Lab-3 node-exporter가 down인 경우:**

```bash
# Lab-3 마스터(10.144.131.100)에 SSH 접속 후 node-exporter DaemonSet 확인
kubectl get ds -n monitoring
kubectl get pods -n monitoring -o wide
```

**네트워크 차단 문제:**

방화벽 담당자에게 Lab-1(10.144.38.100) → Lab-3(10.144.131.x) 간 포트 개방 요청 필요:
- 9100 (node-exporter)
- 9738 (PCM exporter)

### DCIM 영향 범위

- **영향 받는 기능**: Lab-3 서버 메트릭 (CPU, Memory, Power 등), 워크로드 모니터링
- **영향 없는 기능**: Lab-1 서버 메트릭, DB 기반 자산 관리, 인증, 알림 규칙 관리
- Lab-3 데이터 없이도 DCIM 앱 자체는 정상 동작하며, 해당 서버의 메트릭 영역만 비어있음

---

## 10. BMC 접근 불가

BMC(Baseboard Management Controller) 센서 데이터 조회 또는 원격 전원 제어가 실패하는 경우.

### 증상

- 서버 상세 페이지에서 **BMC 센서 데이터 미표시** (온도, 팬 속도, 전압 등)
- **원격 전원 제어 실패** (Power On/Off/Reset 동작 안 함)
- API 호출 시 BMC 관련 timeout 또는 connection refused 에러

### 원인

- DCIM 서버(Lab-1)에서 BMC IP 대역(192.168.10.x)으로 **직접 접근 불가** — BMC 스위치가 별도 네트워크
- Room 설정에 `bmcProxyUrl`이 미설정 또는 잘못된 값
- BMC 프록시 서버(Lab-3 마스터) 다운
- BMC 자체 장애 (펌웨어 행, 네트워크 설정 오류)

### 진단

```bash
# BMC 프록시 서버 연결 테스트
curl -s --connect-timeout 5 "http://10.144.131.100:8080/health"

# Room의 bmcProxyUrl 설정 확인 (DB에서)
docker exec dcim-db psql -U dcim -d dcim -c "SELECT id, name, \"bmcProxyUrl\" FROM \"Room\""

# BMC 직접 접근 테스트 (대부분 실패 예상 — 별도 네트워크)
curl -s --connect-timeout 3 "https://192.168.10.x/redfish/v1/" -k
```

### 복구 절차

**Room의 bmcProxyUrl 설정 확인/수정:**

BMC는 DCIM 서버에서 직접 접근할 수 없으므로 Lab-3 마스터를 프록시로 경유해야 한다.

1. DCIM 웹 UI에서 Room 설정 페이지로 이동
2. 해당 Room의 BMC 프록시 URL이 올바르게 설정되었는지 확인
3. 프록시 URL 형식: `http://10.144.131.100:8080` (Lab-3 마스터)

**BMC 프록시 서버가 다운인 경우:**

Lab-3 마스터(10.144.131.100)에 SSH 접속하여 프록시 서비스 상태를 확인하고 재시작한다.

**개별 BMC 장애:**

- BMC 펌웨어 행: 서버 물리적 전원 사이클 (AC power cycle) 필요
- BMC IP 미설정: 장비 등록 시 BMC IP 필드 확인

### DCIM 영향 범위

- **영향 받는 기능**: BMC 센서 데이터 표시, 원격 전원 제어
- **영향 없는 기능**: Prometheus 기반 메트릭 (CPU, Memory, Disk, Network), 자산 관리, 인증
- BMC 접근 불가 시에도 Prometheus 기반 모니터링은 독립적으로 동작

---

## 장애 에스컬레이션 가이드

| 수준 | 조건 | 대응 |
|------|------|------|
| **Level 1** | 단일 서비스 장애 (앱 또는 DB) | `recovery.sh` 옵션 1~3으로 자체 복구 |
| **Level 2** | 데이터 손실 의심 | `recovery.sh` 옵션 4로 백업 복원, 원인 분석 |
| **Level 3** | Docker/인프라 장애 | Docker 데몬 재시작, 시스템 관리자 협조 |
| **Level 4** | 네트워크/방화벽 문제 | 네트워크 담당자 협조 필요 (Lab-3 연결, BMC 프록시 등) |

---

## 정기 점검 체크리스트 (간략)

| 항목 | 주기 | 명령어/방법 |
|------|------|------------|
| 시스템 상태 | 매일 | `./scripts/recovery.sh` → 옵션 6 |
| DB 백업 확인 | 매일 | `./scripts/backup-db.sh --list` |
| 디스크 용량 | 주 1회 | `df -h` |
| 앱 로그 크기 | 주 1회 | `./scripts/setup-logrotate.sh --status` |
| Docker 디스크 | 월 1회 | `docker system df` |
| Prometheus 타겟 | 주 1회 | `curl -s "http://10.100.175.248:8080/api/v1/targets" \| grep -c '"health":"up"'` |
| 에러 로그 리뷰 | 주 1회 | `./scripts/recovery.sh` → 옵션 5 |

> 상세 점검 체크리스트는 아래 [모니터링 체크리스트](#모니터링-체크리스트) 섹션 참조.

---

## 11. OOM (Out of Memory) — Next.js / Node.js 메모리 초과

Node.js 프로세스가 메모리 한도를 초과하여 OS에 의해 강제 종료된 경우.

### 증상

- 앱이 자동으로 죽었다가 살아나는 현상 반복 (`/tmp/dcim-app.log`에 갑작스러운 종료 기록)
- 브라우저에서 간헐적 502 또는 "연결 거부" 에러
- `dmesg`에 `Out of memory: Kill process ... (node)` 메시지
- 특정 페이지(대용량 보고서, 전체 장비 목록 등) 접근 직후 프로세스 사망

### 원인

- Next.js ISR 빌드 시 복수 페이지를 동시에 프리렌더하며 메모리 급증
- WebSocket 클라이언트 연결 누수 — 연결 해제 없이 이벤트 핸들러 축적
- Prometheus 쿼리 결과를 메모리에 전부 올리는 API 라우트 (pagination 미적용)
- 서버 기본 Node.js 힙 한도(~1.5 GB)가 실제 사용량에 비해 부족

### 진단

```bash
dmesg | grep -iE "oom|killed process" | tail -10
ps -o pid,rss,vsz,comm -p $(pgrep -f "next dev" | head -1)
free -h
tail -100 /tmp/dcim-app.log | grep -iE "heap|memory|oom|fatal"
```

### 복구 절차

```bash
pkill -f "next dev"
export NODE_OPTIONS="--max-old-space-size=4096"
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- `NODE_OPTIONS="--max-old-space-size=4096"`를 `recovery.sh` 앱 시작 섹션에 영구 반영
- 대용량 API 라우트에 페이지네이션 적용 확인
- 로그에 `heap out of memory` 패턴이 보이면 즉시 힙 한도 점검

---

## 12. Prisma Connection Pool 고갈 — DB 커넥션 풀 부족

Prisma Client가 사용 가능한 DB 커넥션 수를 초과하여 쿼리가 대기 상태로 쌓이는 경우.

### 증상

- 앱 로그에 `Timed out fetching a new connection from the connection pool` 에러 (`P2024`)
- 특정 시간대(트래픽 집중 시) API 응답 지연 또는 504 에러
- DB 컨테이너와 앱 자체는 살아 있는데 일부 API만 응답 없음

### 원인

- 기본 Prisma connection pool 크기가 동시 접속 수에 비해 부족
- Next.js `dev` 모드 핫 리로드 시 PrismaClient 인스턴스가 중복 생성
- 장기 실행 쿼리가 연결을 점유

### 진단

```bash
docker exec dcim-db psql -U dcim -d dcim -c \
  "SELECT count(*), state FROM pg_stat_activity WHERE datname='dcim' GROUP BY state"
docker exec dcim-db psql -U dcim -d dcim -c "SHOW max_connections"
grep -c "P2024\|connection pool" /tmp/dcim-app.log
```

### 복구 절차

```bash
# 앱 재시작으로 커넥션 풀 초기화
./scripts/recovery.sh
# 메뉴에서 1 선택

# Pool 크기 상향이 필요한 경우 DATABASE_URL에 파라미터 추가:
# postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public&connection_limit=20
```

### 예방

- `src/lib/prisma.ts`에 PrismaClient 싱글턴 패턴(`globalThis`) 적용 확인
- `pg_stat_activity`를 주 1회 확인하여 `idle in transaction` 상태 누적 여부 점검

---

## 13. SSE/WebSocket 스트림 누적 — 클라이언트 연결 과다로 서버 자원 소진

실시간 메트릭 스트리밍 연결이 정리되지 않고 누적되어 Node.js 이벤트 루프가 막히는 경우.

### 증상

- 대시보드를 장시간 열어 두면 앱 응답 속도가 점진적으로 저하
- 앱 로그에 `MaxListenersExceededWarning` 경고 반복
- `ss -s`에서 ESTABLISHED 소켓 수가 비정상적으로 높음

### 원인

- 브라우저 탭 닫을 때 서버 측 이벤트 핸들러 미정리
- Socket.io 재연결 시 기존 연결 미해제
- SSE 엔드포인트에서 `req.on('close')` 핸들러 미등록

### 진단

```bash
ss -s | grep -i estab
ls /proc/$(pgrep -f "next dev" | head -1)/fd 2>/dev/null | wc -l
grep -E "MaxListeners|ECONNRESET|socket" /tmp/dcim-app.log | tail -20
```

### 복구 절차

```bash
./scripts/recovery.sh
# 메뉴에서 1 선택 (재시작으로 모든 연결 해제)
```

### 예방

- SSE 엔드포인트에 `req.on('close', cleanup)` 패턴 구현
- 앱 재시작을 주 1회 정기 점검에 포함

---

## 14. 환경변수 설정 오류 — .env 파일 누락/변경으로 앱 시작 실패

코드 업데이트 후 환경변수가 초기화되어 앱이 시작되지 않는 경우.

### 증상

- 앱 시작 직후 `Missing environment variable` 또는 `Invalid DATABASE_URL` 에러
- Prisma 초기화 실패: `Error: Environment variable not found: DATABASE_URL`
- 로그인 시 JWT 서명 실패

### 원인

- 파일 복사 시 `.env.local` 파일이 덮어쓰여지거나 삭제됨
- `recovery.sh`의 `DATABASE_URL` 자동 구성이 포트 변경으로 실패

### 진단

```bash
ls -la .env .env.local 2>/dev/null
grep -E "^(DATABASE_URL|NEXTAUTH_SECRET|NEXTAUTH_URL|PROMETHEUS_URL)=" .env .env.local 2>/dev/null | sed 's/=.*/=***/'
docker compose port db 5432
```

### 복구 절차

`.env.local` 파일에 아래 항목이 있어야 한다:

```
DATABASE_URL=postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public
NEXTAUTH_SECRET=운영용-시크릿-값-32자-이상
NEXTAUTH_URL=http://10.144.38.100:3000
PROMETHEUS_URL=http://10.100.175.248:8080
```

설정 후 `./scripts/recovery.sh` 옵션 1 실행.

### 예방

- 코드 업데이트 절차에 "`.env.local` 보존 확인" 단계 명시
- `.env.local`을 별도 안전한 위치(`$HOME/.dcim-env.backup`)에 사본 유지

---

## 15. Docker Network 장애 — 컨테이너 간 통신 불가

`dcim-app`과 `dcim-db` 컨테이너가 각각 실행 중이지만 서로 통신 불가.

### 증상

- 두 컨테이너 모두 `running` 상태이나 앱 로그에 `ECONNREFUSED` 또는 `P1001` 에러
- `docker exec dcim-app ping dcim-db` 실패

### 원인

- Docker 데몬 재시작 후 브리지 네트워크 복구 실패
- iptables 규칙 초기화로 컨테이너 간 패킷 차단

### 진단

```bash
docker network ls | grep dcim
docker network inspect dcim_default 2>/dev/null | grep -A5 '"Containers"'
docker exec dcim-db pg_isready -h dcim-db -U dcim
```

### 복구 절차

```bash
docker compose down
docker compose up -d
sleep 10 && docker compose ps
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- `docker compose down -v` 사용 금지 (볼륨+네트워크 삭제됨)
- Docker 업데이트 후 반드시 `docker compose ps` + DB 연결 테스트

---

## 16. PostgreSQL Volume 손상 — Docker 볼륨 파손으로 DB 시작 불가

Docker 볼륨이 손상되어 PostgreSQL 컨테이너가 시작되지 않는 경우.

### 증상

- `docker compose ps db`에서 `restarting` 또는 `exited` 반복
- `docker compose logs db`에 `PANIC: could not locate a valid checkpoint record` 에러

### 원인

- 서버 강제 종료/전원 차단 시 WAL 로그 미완료 종료
- 디스크 공간 부족 상태에서 강제 종료

### 진단

```bash
docker compose ps db
docker compose logs db --tail=30
dmesg | grep -iE "ext4|xfs|filesystem|i/o error" | tail -10
```

### 복구 절차

```bash
# 백업에서 완전 복원
pkill -f "next dev"
docker compose down
docker volume rm dcim_pgdata
docker compose up -d db
sleep 20 && docker compose ps db
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"
npx prisma migrate deploy
./scripts/backup-db.sh --restore
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- `./scripts/backup-db.sh --install`로 매일 자동 백업 활성화
- 서버 재부팅 전 반드시 `docker compose down`으로 정상 종료

---

## 17. BMC 프록시 장애 — Lab-3 BMC 접근 프록시 서버 장애

Lab-3 마스터에서 실행 중인 BMC 프록시 서비스가 다운된 경우.

### 증상

- 서버 상세 페이지 BMC 섹션에서 모든 센서 데이터 미표시
- 원격 전원 제어 시 "프록시 연결 실패" 에러
- Prometheus 기반 메트릭은 정상 — BMC 전용 기능만 불가

### 원인

- Lab-3 마스터의 BMC 프록시 프로세스 크래시 또는 노드 재부팅
- Lab-1 → Lab-3 네트워크 차단

### 진단

```bash
curl -s --connect-timeout 5 "http://10.144.131.100:8080/health"
ping -c 3 10.144.131.100
docker exec dcim-db psql -U dcim -d dcim -c "SELECT id, name, \"bmcProxyUrl\" FROM \"Room\""
```

### 복구 절차

Lab-3 마스터에 SSH 접속하여 프록시 서비스 확인 및 재시작.

### 예방

- Lab-3 마스터 재부팅 후 BMC 프록시 자동 시작 설정
- 주 1회 BMC 프록시 헬스체크

---

## 18. Multi-Prometheus 부분 장애 — Lab-1 정상, Lab-3 타겟 일부 down

Lab-1 Prometheus는 정상이지만 Lab-3 서버들의 일부 메트릭 타겟이 down인 경우.

### 증상

- 대시보드 전체는 정상이지만 특정 Lab-3 서버의 메트릭만 빈 값
- 타겟 페이지에서 일부 Lab-3 타겟이 `down` 표시

### 원인

- Lab-3 개별 서버의 node-exporter Pod 장애
- Lab-1 → Lab-3 간 특정 포트 선택적 차단
- Lab-3 서버 일부가 NotReady 상태

### 진단

```bash
curl -s "http://10.100.175.248:8080/api/v1/targets" | grep -o '"health":"[^"]*"' | sort | uniq -c
curl -s "http://10.100.175.248:8080/api/v1/targets" | grep -B2 '"health":"down"' | grep '"instance"' | grep "131\." | head -10
```

### 복구 절차

Lab-3 마스터에서 node-exporter DaemonSet 상태 확인 및 문제 Pod 재시작.

앱 측에서는 조치 불필요 — 가용한 데이터만 표시하고 나머지는 "데이터 없음" 처리.

### 예방

- 주 1회 Lab-3 타겟 up 여부 점검
- Lab-3 노드 IP 변경 시 Lab-1 Prometheus 설정에 즉시 반영

---

## 19. NextAuth 인증 장애 — JWT 시크릿 변경/세션 만료 대량 발생

`NEXTAUTH_SECRET` 변경 후 모든 사용자의 세션이 일시에 무효화되는 경우.

### 증상

- 로그인된 사용자 전원이 동시에 세션 만료 메시지
- 앱 로그에 `JWTDecodeError`, `invalid signature` 에러 반복

### 원인

- `NEXTAUTH_SECRET` 값이 이전과 달라져서 기존 JWT 서명 검증 실패
- 앱 재시작 시 `NEXTAUTH_SECRET`이 누락되어 임의 시크릿 생성

### 진단

```bash
cat /proc/$(pgrep -f "next dev" | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep -c "NEXTAUTH_SECRET"
grep -cE "JWTDecodeError|jwt malformed|invalid signature" /tmp/dcim-app.log
```

### 복구 절차

```bash
# .env.local에 고정된 시크릿 값 확인/설정
grep "NEXTAUTH_SECRET" .env.local 2>/dev/null | wc -c

# 없다면 새 시크릿 생성
openssl rand -base64 32
# 출력 값을 .env.local의 NEXTAUTH_SECRET에 기록

./scripts/recovery.sh
# 메뉴에서 1 선택
# 재시작 후 모든 사용자 한 번 재로그인 필요 (정상 동작)
```

### 예방

- `NEXTAUTH_SECRET`은 `.env.local`에 고정 문자열로 저장
- `NEXTAUTH_URL=http://10.144.38.100:3000` 명시 — `localhost` 사용 금지

---

## 20. Next.js Build 실패 — 배포 시 빌드 실패

`npm run build` 실행 시 빌드가 중단되는 경우.

### 증상

- ISR 페이지(`/racks`, `/reports`)에서 `PrismaClientInitializationError`
- TypeScript 타입 에러 또는 import 경로 오류
- Server Component에서 Client Component 전용 API 사용

### 원인

- 빌드 환경에 `DATABASE_URL`이 없어 ISR 페이지 프리렌더 실패
- Prisma 스키마 변경 후 `prisma generate` 미실행

### 진단

```bash
npm run verify 2>&1 | tail -30
npx prisma generate
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"
npm run build 2>&1 | grep -E "Error|error|failed" | head -20
```

### 복구 절차

```bash
# Prisma 클라이언트 재생성
npx prisma generate

# DB 연결 가능 시 빌드
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"
npm run build

# 성공 후 앱 재시작
./scripts/recovery.sh
# 메뉴에서 1 선택
```

### 예방

- 코드 배포 절차에 `npm run verify` → DB 있으면 `npm run verify:full` 포함
- Prisma 스키마 변경 후 `npx prisma generate` 즉시 실행

---

## 복구 우선순위 매트릭스

| 우선순위 | 정의 | 해당 시나리오 | 목표 복구 시간 |
|----------|------|--------------|---------------|
| **P0** — 전체 서비스 중단 | 모든 사용자 접근 불가 | #1 앱 다운, #2 DB 장애, #8 Docker 장애, #14 환경변수 오류, #15 Docker Network | 즉시 (15분 이내) |
| **P1** — 주요 기능 중단 | 핵심 기능 불가, 데이터 손실 위험 | #3 데이터 손상, #11 OOM 반복, #16 Volume 손상, #19 인증 장애 | 1시간 이내 |
| **P2** — 기능 저하 | 일부 기능 불가, 핵심 자산 관리는 동작 | #4 Prometheus 불가, #7 마이그레이션 실패, #12 커넥션 풀, #13 WebSocket, #20 빌드 실패 | 4시간 이내 |
| **P3** — 부분 기능 저하 | 특정 서버 메트릭 또는 BMC만 불가 | #5 디스크 부족, #6 인증 세션, #9 Lab-3 Prometheus, #10 BMC 불가, #17 BMC 프록시, #18 부분 장애 | 당일 처리 |

### P0 장애 즉시 대응 흐름

```
P0 감지
  └─ Docker 데몬 살아있나?
       ├─ 아니오 → sudo systemctl start docker → docker compose up -d → recovery.sh 옵션 1
       └─ 예 → 컨테이너 상태?
                 ├─ DB 다운 → recovery.sh 옵션 2 or 3
                 ├─ 앱 다운 → recovery.sh 옵션 1
                 └─ 둘 다 다운 → recovery.sh 옵션 3
```

---

## 모니터링 체크리스트

### 일일 점검 (매 영업일 오전)

| 항목 | 확인 명령 | 정상 기준 |
|------|----------|----------|
| 앱 응답 | `curl -s -o /dev/null -w "%{http_code}" http://10.144.38.100:3000/api/health` | 200 |
| DB 상태 | `docker exec dcim-db pg_isready -U dcim -d dcim` | `accepting connections` |
| DB 백업 존재 | `./scripts/backup-db.sh --list \| tail -1` | 오늘 날짜 백업 있음 |
| 앱 에러 | `grep -c "Error\|FATAL" /tmp/dcim-app.log` | 전일 대비 급증 없음 |
| Prometheus 연결 | `curl -s --connect-timeout 3 http://10.100.175.248:8080/-/healthy` | `Prometheus is Healthy` |
| OOM 발생 | `dmesg \| grep -c "Killed process"` | 0 |

### 주간 점검 (매주 월요일)

| 항목 | 확인 명령 | 조치 기준 |
|------|----------|----------|
| 디스크 사용량 | `df -h` | 80% 이상 시 정리 |
| 앱 로그 크기 | `du -sh /tmp/dcim-app.log` | 500 MB 이상 시 로테이션 |
| DB 백업 용량 | `du -sh $HOME/dcim-backups/` | 7일 초과분 정리 |
| Docker 디스크 | `docker system df` | 이미지/빌드 캐시 누적 시 `docker system prune -f` |
| Prometheus 타겟 | `curl -s "http://10.100.175.248:8080/api/v1/targets" \| grep -c '"health":"up"'` | 감소 시 원인 파악 |
| Lab-3 타겟 | `curl -s "http://10.100.175.248:8080/api/v1/targets" \| grep "131\." \| grep -c '"health":"up"'` | 감소 시 시나리오 #18 참조 |
| DB 커넥션 | `docker exec dcim-db psql -U dcim -d dcim -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='dcim' GROUP BY state"` | `idle in transaction` 누적 시 앱 재시작 |
| BMC 프록시 | `curl -s --connect-timeout 3 http://10.144.131.100:8080/health` | 실패 시 시나리오 #17 참조 |

### 월간 점검 (매월 1일)

| 항목 | 확인/조치 | 참고 |
|------|----------|------|
| Docker 전체 정리 | `docker system prune -f && docker image prune -a -f` | 볼륨(-v)은 제외 |
| 패스워드/시크릿 점검 | `NEXTAUTH_SECRET`, DB 패스워드가 기본값인지 확인 | `grep "change-me" .env.local` |
| Node.js 힙 사용 추이 | `dmesg --since "30 days ago" \| grep -c "Killed process"` | 반복 시 `NODE_OPTIONS` 상향 |
| Prisma 마이그레이션 상태 | `npx prisma migrate status` | Pending 있으면 즉시 적용 |
| 로그 로테이션 상태 | `./scripts/setup-logrotate.sh --status` | 미설정 시 즉시 설정 |
| cron 자동 백업 확인 | `crontab -l \| grep backup-db` | 없으면 `./scripts/backup-db.sh --install` 재실행 |

---

## 엣지 케이스

코드 분석에서 발견된 잠재적 문제들. 특정 조건이 겹쳤을 때만 발생하는 비정형 장애.

### EC-1: ISR 페이지 빌드 후 DB 스키마 변경 시 불일치

ISR로 빌드된 `/racks`, `/reports` HTML 캐시와 새 스키마 간 데이터 형식 불일치. 스키마 변경 후 반드시 앱 완전 재시작.

### EC-2: Prometheus `or` 연산자 중복 카운팅

node-exporter와 cAdvisor 모두에서 동일 서버가 수집될 때 `or` PromQL로 값이 2배 집계될 수 있음.

```bash
curl -s "http://10.100.175.248:8080/api/v1/query?query=up" | grep -o '"instance":"[^"]*"' | sort | uniq -d | head -5
```

### EC-3: Next.js dev 모드 PrismaClient 인스턴스 중복

핫 리로드 시 PrismaClient 중복 생성 → DB 커넥션 누수. `src/lib/prisma.ts`의 `globalThis` 싱글턴 패턴 확인.

### EC-4: Docker 포트 매핑 변경 후 DATABASE_URL 불일치

`docker-compose.yml` 포트 변경 시 `.env.local`의 `DATABASE_URL` 포트도 함께 수정 필요.

### EC-5: WebSocket 서버와 Next.js 포트 충돌

앱 재시작 시 이전 WebSocket이 포트 3000을 점유하면 `EADDRINUSE` 에러. `kill -9 $(ss -tlnp | grep 3000 | grep -oP 'pid=\K\d+')` 후 재시작.

### EC-6: Lab-3 Prometheus 직접 쿼리 시 타겟 0개

`PROMETHEUS_URL`이 Lab-3 Prometheus로 설정되어 있으면 K8s API 접근 불가로 모든 메트릭이 비어 있음. Lab-1 ClusterIP(`http://10.100.175.248:8080`)로 변경 필요.
