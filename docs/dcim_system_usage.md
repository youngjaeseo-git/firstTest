# DCIM 시스템 운영 가이드

> DC Express (DRAM AE DCIM Management System) 설치, 실행, 운영에 관한 종합 문서

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [사전 요구사항](#2-사전-요구사항)
3. [실행 방법](#3-실행-방법)
   - 3.1 [수동 실행 (run.sh)](#31-수동-실행-runsh)
   - 3.2 [systemd 서비스 등록](#32-systemd-서비스-등록)
   - 3.3 [로컬 개발 (dev.sh)](#33-로컬-개발-devsh)
4. [코드 업데이트 및 배포](#4-코드-업데이트-및-배포)
   - 4.1 [서비스 모드에서 코드 반영](#41-서비스-모드에서-코드-반영)
   - 4.2 [deploy-update.sh 자동 배포](#42-deploy-updatesh-자동-배포)
   - 4.3 [수동 배포 절차](#43-수동-배포-절차)
5. [DB 관리](#5-db-관리)
   - 5.1 [DB 컨테이너 관리](#51-db-컨테이너-관리)
   - 5.2 [백업 및 복원](#52-백업-및-복원)
   - 5.3 [마이그레이션](#53-마이그레이션)
   - 5.4 [DB 직접 조회](#54-db-직접-조회)
6. [로그 관리](#6-로그-관리)
7. [장애 복구](#7-장애-복구)
8. [운영 모드 전환 (dev / prod)](#8-운영-모드-전환-dev--prod)
9. [주요 설정값](#9-주요-설정값)
10. [자주 쓰는 명령어 요약](#10-자주-쓰는-명령어-요약)
11. [문제 해결 (Troubleshooting)](#11-문제-해결-troubleshooting)

---

## 1. 시스템 개요

### 구성 요소

| 구성 요소 | 설명 | 위치 |
|-----------|------|------|
| **Next.js 앱** | DCIM 웹 애플리케이션 (프론트엔드 + API) | 호스트에서 직접 실행 |
| **PostgreSQL** | 자산/설정 데이터 저장 | Docker 컨테이너 (`docker compose`) |
| **Prometheus** | 시계열 메트릭 수집 (CPU, 메모리, 온도 등) | K8s 클러스터 내부 서비스 |
| **BMC Proxy** | Lab-3 BMC 접근용 리버스 프록시 | Lab-3 마스터 노드 |

### 네트워크 구성

| 서비스 | 주소 |
|--------|------|
| DCIM 웹 | `http://10.144.38.100:3000` |
| PostgreSQL | `localhost:5432` (Docker 포트 매핑) |
| Prometheus (ClusterIP) | `http://10.100.175.248:8080` |
| Prometheus (NodePort) | `http://10.144.38.100:30003` |

### 디렉토리 구조 (운영 관련)

```
firstTest/
├── run.sh                    # 수동 실행 스크립트 (서버용)
├── dev.sh                    # 로컬 개발용 실행 스크립트
├── deploy-update.sh          # 자동 배포 스크립트
├── docker-compose.yml        # PostgreSQL 컨테이너 정의
├── scripts/
│   ├── setup-service.sh      # systemd 서비스 설치/관리
│   ├── service-start.sh      # systemd에서 호출하는 시작 스크립트
│   ├── backup-db.sh          # DB 백업/복원
│   ├── setup-logrotate.sh    # 로그 로테이션 설정
│   └── recovery.sh           # 장애 복구 대화형 도구
├── prisma/
│   └── schema.prisma         # DB 스키마 정의
└── docs/
    ├── infrastructure.md     # 인프라 환경 정보
    ├── features.md           # 기능 목록 및 구현 현황
    └── cmd_usage.md          # 개발 명령어 참조
```

---

## 2. 사전 요구사항

### 서버 환경 (10.144.38.100)

| 항목 | 요구사항 | 확인 명령 |
|------|----------|-----------|
| Node.js 20 | `$HOME/opt/node-20/bin`에 설치 | `$HOME/opt/node-20/bin/node -v` |
| Docker | 실행 중 | `docker info` |
| docker compose | v2 플러그인 | `docker compose version` |
| Git | 코드 업데이트용 | `git --version` |

### 환경 변수 (자동 설정)

아래 환경 변수는 `run.sh` 또는 `service-start.sh`가 자동으로 설정합니다. 직접 지정할 필요가 없습니다.

| 변수 | 설명 | 자동 값 |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | Docker 컨테이너에서 비밀번호/포트 자동 추출 |
| `NEXTAUTH_SECRET` | JWT 서명 키 | `dcim-nextauth-secret-{hostname}` |
| `NEXTAUTH_URL` | 인증 콜백 URL | `http://{서버IP}:{포트}` |

---

## 3. 실행 방법

### 3.1 수동 실행 (run.sh)

기존 방식. 터미널을 열고 직접 실행합니다. 터미널을 닫으면 서버도 종료됩니다.

```bash
cd ~/firstTest

# 기본 실행 (포트 3000)
bash run.sh

# 포트 지정
bash run.sh 8080

# 데모 모드 (Prometheus 없이 더미 데이터로 UI 확인)
bash run.sh dummy

# 데모 + 포트 지정
bash run.sh dummy 8080
```

**실행 순서:**
1. Docker 데몬 확인
2. DB 컨테이너 상태 확인 (필요 시 자동 시작, 30초 대기)
3. DB 비밀번호/포트 자동 추출 → `DATABASE_URL` 설정
4. `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 설정
5. Prisma 마이그레이션 실행
6. `npm run dev -- -p {포트}` 로 개발 서버 시작

**종료:** `Ctrl+C`

**코드 수정 후 재시작:**
```bash
# 기존 서버 종료 (Ctrl+C 또는)
kill $(lsof -t -i:3000)

# 빌드 캐시 삭제 (선택 — 변경이 반영되지 않을 때)
rm -rf .next

# 재시작
bash run.sh
```

---

### 3.2 systemd 서비스 등록

서비스로 등록하면 서버 재부팅 시 자동 시작되고, 장애 시 자동 재시작됩니다.

#### 설치 (최초 1회)

```bash
cd ~/firstTest
./scripts/setup-service.sh --install
```

이 명령이 수행하는 작업:
1. `service-start.sh`에 실행 권한 부여
2. `/etc/systemd/system/dcim.service` 파일 생성
3. `systemctl daemon-reload`
4. `systemctl enable dcim` (부팅 시 자동 시작)
5. `systemctl start dcim` (즉시 시작)

#### 일상 운영 명령

```bash
# 서비스 상태 확인
systemctl status dcim

# 실시간 로그 보기
journalctl -u dcim -f

# 서비스 재시작 (코드 변경 후)
systemctl restart dcim

# 서비스 중지
systemctl stop dcim

# 서비스 시작
systemctl start dcim
```

#### 관리 스크립트 명령

```bash
# 상태 확인
./scripts/setup-service.sh --status

# 재시작 (상태 자동 출력)
./scripts/setup-service.sh --restart

# 실시간 로그
./scripts/setup-service.sh --logs

# 서비스 제거 (중지 + 비활성화 + 파일 삭제)
./scripts/setup-service.sh --uninstall
```

#### 서비스 파일 위치 및 구조

`/etc/systemd/system/dcim.service`:

```ini
[Unit]
Description=DCIM Management System (DC Express)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User={실행유저}
WorkingDirectory={프로젝트경로}
ExecStart={프로젝트경로}/scripts/service-start.sh
Environment=PATH={홈}/opt/node-20/bin:/usr/local/sbin:...
Environment=DCIM_MODE=dev
Environment=DCIM_PORT=3000
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dcim

[Install]
WantedBy=multi-user.target
```

| 설정 | 설명 |
|------|------|
| `Requires=docker.service` | Docker가 먼저 시작된 후 실행 |
| `Restart=on-failure` | 비정상 종료 시 자동 재시작 |
| `RestartSec=10` | 재시작 전 10초 대기 |
| `DCIM_MODE=dev` | 개발 모드 (hot-reload). `prod`로 변경 가능 |
| `DCIM_PORT=3000` | 리스닝 포트 |

---

### 3.3 로컬 개발 (dev.sh)

Mac mini 등 개발 환경에서 사용합니다.

```bash
cd ~/firstTest
./dev.sh
```

**실행 순서:**
1. `git pull` (최신 코드 동기화)
2. `npm install` (패키지 설치)
3. Docker DB 확인/시작
4. `npm run dev -- -p 3001` (포트 3001)

---

## 4. 코드 업데이트 및 배포

### 4.1 서비스 모드에서 코드 반영

**systemd 서비스로 실행 중일 때** 코드를 업데이트하는 방법:

```bash
cd ~/firstTest

# 1. 최신 코드 받기
git pull

# 2. 패키지 변경이 있으면 설치
npm install --prefer-offline

# 3. 서비스 재시작
systemctl restart dcim
```

한 줄로:
```bash
cd ~/firstTest && git pull && systemctl restart dcim
```

dev 모드에서는 대부분의 코드 변경(컴포넌트, API 등)이 **hot-reload로 자동 반영**됩니다.
재시작이 필요한 경우:
- `package.json` 변경 (새 패키지 추가)
- `prisma/schema.prisma` 변경
- 환경 변수 변경
- `next.config.js` 변경

### 4.2 deploy-update.sh 자동 배포

DB 백업 + 코드 업데이트 + 마이그레이션 + 헬스체크까지 한 번에 수행합니다.

```bash
# 기본 (포트 3000)
./deploy-update.sh

# 포트 지정
./deploy-update.sh 3001
```

**실행 순서:**
1. 기존 서버 프로세스 종료
2. DB 컨테이너 확인
3. 배포 전 DB 백업 (안전장치)
4. 코드 업데이트 (`git pull` 또는 NFS tar 파일)
5. `npm install`
6. Prisma generate + migrate
7. 서버 시작 + 15초 내 헬스체크

**배포 로그:** `$HOME/dcim-logs/deploy-YYYYMMDD-HHMMSS.log`

> 참고: systemd 서비스 사용 시에는 `deploy-update.sh` 대신 `git pull && systemctl restart dcim`을 권장합니다.

### 4.3 수동 배포 절차

자동 스크립트를 사용하지 않고 단계별로 수행할 때:

```bash
cd ~/firstTest

# 1. 기존 서버 중지
systemctl stop dcim            # 서비스 모드
# 또는
kill $(lsof -t -i:3000)       # 수동 실행 모드

# 2. 코드 업데이트
git pull

# 3. 패키지 설치 (package.json 변경 시)
npm install

# 4. DB 마이그레이션 (schema.prisma 변경 시)
export DATABASE_URL="postgresql://dcim:dcim_password@localhost:5432/dcim?schema=public"
npx prisma migrate deploy
npx prisma generate

# 5. 빌드 캐시 삭제 (문제 발생 시)
rm -rf .next

# 6. 서버 시작
systemctl start dcim           # 서비스 모드
# 또는
bash run.sh                    # 수동 실행 모드
```

---

## 5. DB 관리

### 5.1 DB 컨테이너 관리

PostgreSQL은 Docker 컨테이너로 실행됩니다.

```bash
cd ~/firstTest

# 상태 확인
docker compose ps db

# 시작
docker compose up -d db

# 재시작
docker compose restart db

# 중지
docker compose down

# 로그 확인
docker compose logs db --tail=50
```

**docker-compose.yml 설정:**

| 항목 | 값 |
|------|-----|
| 이미지 | `postgres:16-alpine` |
| DB 이름 | `dcim` |
| 사용자 | `dcim` |
| 비밀번호 | `dcim_password` (기본값) |
| 포트 | `5432:5432` |
| 데이터 볼륨 | `pgdata` (영속적) |
| 헬스체크 | `pg_isready -U dcim -d dcim` (5초 간격) |

### 5.2 백업 및 복원

#### 자동 백업 설정

```bash
# cron 자동 백업 등록 (매일 03:00)
./scripts/backup-db.sh --install

# cron 등록 해제
./scripts/backup-db.sh --uninstall
```

#### 수동 백업/복원

```bash
# 즉시 백업
./scripts/backup-db.sh

# 백업 목록 확인
./scripts/backup-db.sh --list

# 최근 백업에서 복원 (확인 프롬프트 있음)
./scripts/backup-db.sh --restore
```

| 항목 | 값 |
|------|-----|
| 백업 위치 | `$HOME/dcim-backups/` |
| 파일 형식 | `dcim-YYYYMMDD-HHMMSS.sql.gz` |
| 보관 기간 | 7일 (자동 삭제) |
| 백업 방식 | `pg_dump --clean --if-exists` + gzip 압축 |

#### 복원 시 안전장치
- 복원 전 현재 DB 상태를 자동 백업 (`dcim-pre-restore-*.sql.gz`)
- `yes` 입력 확인 후 복원 실행

### 5.3 마이그레이션

Prisma ORM으로 DB 스키마를 관리합니다.

```bash
# 마이그레이션 적용 (배포/운영 환경)
npx prisma migrate deploy

# 마이그레이션 생성 (개발 환경에서 스키마 변경 후)
npx prisma migrate dev --name 변경내용_설명

# Prisma 클라이언트 재생성
npx prisma generate

# 스키마 검증
npx prisma validate

# DB 브라우저 (개발용)
npx prisma studio
```

> `service-start.sh`는 시작 시 자동으로 `prisma migrate deploy` + `prisma generate`를 실행합니다.

### 5.4 DB 직접 조회

```bash
# Docker 컨테이너에서 psql 실행
docker exec -it $(docker compose ps -q db) psql -U dcim -d dcim

# 한 줄 쿼리 실행
docker exec $(docker compose ps -q db) psql -U dcim -d dcim -c "SELECT count(*) FROM \"Equipment\";"

# 테이블 목록
docker exec $(docker compose ps -q db) psql -U dcim -d dcim -c "\dt"
```

---

## 6. 로그 관리

### 로그 위치

| 실행 방식 | 로그 위치 | 보기 명령 |
|-----------|-----------|-----------|
| systemd 서비스 | journald | `journalctl -u dcim -f` |
| 수동 실행 (run.sh) | 터미널 출력 | 터미널에서 직접 확인 |
| deploy-update.sh | `/tmp/dcim-app.log` + 배포 로그 | `tail -f /tmp/dcim-app.log` |

### journalctl 유용한 옵션

```bash
# 실시간 로그 스트리밍
journalctl -u dcim -f

# 최근 100줄
journalctl -u dcim -n 100

# 오늘 로그만
journalctl -u dcim --since today

# 특정 시간 범위
journalctl -u dcim --since "2026-06-17 09:00" --until "2026-06-17 12:00"

# 에러만 필터
journalctl -u dcim -p err

# 부팅 이후 전체
journalctl -u dcim -b
```

### 로그 로테이션 설정

`/tmp/dcim-app.log` 파일(수동 실행/deploy-update.sh 사용 시)의 로테이션:

```bash
# 설정 + cron 등록 (매일 04:00)
./scripts/setup-logrotate.sh

# 현재 로그 상태 확인
./scripts/setup-logrotate.sh --status

# 즉시 로테이션 실행
./scripts/setup-logrotate.sh --rotate
```

| 항목 | 값 |
|------|-----|
| 로테이션 주기 | 매일 또는 50MB 초과 시 |
| 보관 기간 | 7일 |
| 보관 위치 | `$HOME/dcim-logs/` |
| 압축 | gzip (1일 지연) |

---

## 7. 장애 복구

### 대화형 복구 도구

```bash
./scripts/recovery.sh
```

메뉴:
1. 앱 서버만 재시작
2. DB 컨테이너 재시작
3. 전체 재시작 (DB + 마이그레이션 + 앱)
4. 백업에서 DB 복원
5. 최근 에러 로그 확인
6. 시스템 상태 다시 확인

### 빠른 복구 절차

#### 앱이 응답하지 않을 때

```bash
# 서비스 모드
systemctl restart dcim

# 수동 모드
kill $(lsof -t -i:3000)
bash run.sh
```

#### DB 연결 오류

```bash
# DB 컨테이너 상태 확인
docker compose ps db

# DB 재시작
docker compose restart db

# 30초 대기 후 앱 재시작
systemctl restart dcim
```

#### 마이그레이션 오류

```bash
# 현재 마이그레이션 상태 확인
npx prisma migrate status

# 강제 적용 (주의: 데이터 손실 가능)
npx prisma db push --accept-data-loss
```

#### 빌드 캐시 문제 (변경 미반영)

```bash
rm -rf .next node_modules/.cache
systemctl restart dcim
```

---

## 8. 운영 모드 전환 (dev / prod)

### dev 모드 (기본)

- **hot-reload 지원**: 코드 변경 시 자동 반영 (재시작 불필요)
- Next.js 개발 서버 (`next dev`) 사용
- 상세 에러 메시지 표시
- 소스맵 포함
- 메모리 사용량 높음 (webpack dev server)

### prod 모드

- **최적화된 빌드**: 번들 압축, 코드 분할
- Next.js 프로덕션 서버 (`next build` + `next start`) 사용
- 빠른 페이지 로드
- 낮은 메모리 사용량
- 코드 변경 시 빌드 + 재시작 필요 (1~2분 소요)

### 전환 방법

```bash
# 서비스 파일 편집
sudo vi /etc/systemd/system/dcim.service

# Environment=DCIM_MODE=dev 를 아래로 변경:
# Environment=DCIM_MODE=prod

# 변경 적용
sudo systemctl daemon-reload
systemctl restart dcim
```

> `service-start.sh`는 prod 모드에서 소스 변경이 감지되면 자동으로 `npm run build`를 실행합니다.

### 권장 사항

| 상황 | 권장 모드 |
|------|-----------|
| 활발한 개발 단계 | dev (hot-reload로 빠른 반복) |
| 기능 안정화 후 | prod (성능 최적화) |
| UI 확인/디버깅 | dev (상세 에러 메시지) |
| 다수 사용자 접속 | prod (리소스 효율) |

---

## 9. 주요 설정값

### 포트 변경

```bash
# 서비스 모드: 서비스 파일 수정
sudo vi /etc/systemd/system/dcim.service
# Environment=DCIM_PORT=3000 → 원하는 포트로 변경
sudo systemctl daemon-reload
systemctl restart dcim

# 수동 모드
bash run.sh 8080
```

### Prometheus URL

앱이 사용하는 Prometheus 주소는 `src/lib/prometheus.ts`에서 환경 변수로 읽습니다:

```
PROMETHEUS_URL=http://10.100.175.248:8080  (기본값, ClusterIP)
```

### 인증 계정

기본 관리자 계정 (Prisma seed):

| 항목 | 값 |
|------|-----|
| 이메일 | `admin@dcim.local` |
| 비밀번호 | `admin123` |
| 역할 | Admin |

> 최초 설치 후 비밀번호를 변경하고, 필요한 사용자 계정을 추가하세요.

---

## 10. 자주 쓰는 명령어 요약

### 서비스 관리

```bash
systemctl status dcim              # 상태 확인
systemctl restart dcim             # 재시작
systemctl stop dcim                # 중지
systemctl start dcim               # 시작
journalctl -u dcim -f              # 실시간 로그
journalctl -u dcim -n 50           # 최근 50줄
```

### 코드 업데이트

```bash
git pull && systemctl restart dcim  # 서비스 모드 (가장 간단)
./deploy-update.sh                  # 자동 배포 (백업 포함)
```

### DB 관리

```bash
./scripts/backup-db.sh             # 즉시 백업
./scripts/backup-db.sh --list      # 백업 목록
./scripts/backup-db.sh --restore   # 복원
docker compose ps db               # DB 컨테이너 상태
docker compose restart db          # DB 재시작
```

### 로그/진단

```bash
journalctl -u dcim -f              # 앱 로그 (서비스 모드)
tail -f /tmp/dcim-app.log          # 앱 로그 (수동 모드)
docker compose logs db --tail=30   # DB 로그
./scripts/recovery.sh              # 대화형 장애 복구
```

### 서비스 설치/제거

```bash
./scripts/setup-service.sh --install    # 설치
./scripts/setup-service.sh --uninstall  # 제거
./scripts/setup-service.sh --status     # 상태
./scripts/setup-service.sh --logs       # 로그
```

---

## 11. 문제 해결 (Troubleshooting)

### "DB 준비 실패 (30초 타임아웃)"

```bash
# Docker 데몬 실행 확인
sudo systemctl status docker

# DB 컨테이너 로그 확인
docker compose logs db --tail=50

# 볼륨 문제 시 재생성 (데이터 삭제됨!)
docker compose down -v
docker compose up -d db
```

### "NEXTAUTH_URL mismatch" / 로그인 후 빈 화면

원인: `NEXTAUTH_URL`과 실제 접속 URL이 다르거나, `NEXTAUTH_SECRET`이 변경됨

```bash
# 현재 설정 확인
systemctl show dcim | grep Environment

# 서비스 재시작 (시크릿 재생성)
systemctl restart dcim
```

### 코드 변경이 반영되지 않음 (dev 모드)

```bash
# .next 캐시 삭제
rm -rf .next

# node_modules 캐시도 삭제
rm -rf node_modules/.cache

# 서비스 재시작
systemctl restart dcim
```

### 코드 변경이 반영되지 않음 (prod 모드)

prod 모드에서는 반드시 재빌드가 필요합니다:

```bash
# service-start.sh가 자동으로 변경 감지 후 빌드하지만,
# 수동으로 하려면:
npm run build
systemctl restart dcim
```

### 포트가 이미 사용 중 ("EADDRINUSE")

```bash
# 해당 포트 사용 중인 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill $(lsof -t -i:3000)

# 서비스 재시작
systemctl restart dcim
```

### Prisma 마이그레이션 충돌

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 실패한 마이그레이션 해결
npx prisma migrate resolve --applied {마이그레이션_이름}

# 최후 수단: 스키마를 DB에 직접 반영 (마이그레이션 히스토리 무시)
npx prisma db push
```

### Docker 디스크 용량 부족

```bash
# Docker 사용량 확인
docker system df

# 미사용 이미지/컨테이너 정리
docker system prune -f

# 미사용 볼륨도 정리 (주의: 사용하지 않는 DB 데이터 삭제됨)
docker volume prune -f
```

### systemd 서비스가 시작되지 않음

```bash
# 상세 상태 확인
systemctl status dcim -l

# 최근 실패 로그
journalctl -u dcim --since "5 min ago"

# 서비스 파일 문법 확인
systemd-analyze verify /etc/systemd/system/dcim.service

# 경로/권한 확인
ls -la ~/firstTest/scripts/service-start.sh
```

---

> 이 문서는 2026-06-17 기준입니다. 최신 정보는 각 스크립트의 `--help` 또는 소스를 참조하세요.
