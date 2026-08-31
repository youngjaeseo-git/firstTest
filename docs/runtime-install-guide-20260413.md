# Node.js / Docker Compose 사용자 로컬 설치 가이드

> 이 문서는 기존 시스템에 설치된 패키지를 **건드리지 않고**, 사용자 홈 디렉터리(`$HOME`) 안에만 Node.js와 Docker Compose v2를 설치하는 방법을 정리한 것입니다.
>
> **전제 조건**
> - 타깃 서버에 Docker는 이미 설치되어 있음 (20.10.12 이상)
> - Node / npm / Docker Compose는 설치되어 있지 않음
> - 기존 워크로드와의 호환성 때문에 시스템 패키지 변경은 불가

---

## 0. 핵심 원칙

- `sudo` 사용하지 않음
- `apt`, `yum` 같은 패키지 매니저 사용하지 않음
- 모든 설치물은 `$HOME` 안에만 들어감
- 쉘 프로필(`~/.bashrc`)에서 PATH만 추가
- 제거할 때는 디렉터리만 삭제하면 원상 복구

---

## 1. Node.js / npm 설치 (단일 tarball 방식)

Node.js는 공식 사이트에서 **미리 빌드된 바이너리**를 배포합니다. 압축만 풀면 그 안에 `node`와 `npm`이 이미 들어있어 "설치" 과정이 필요 없습니다.

### 1.1 설치 절차 (인터넷이 되는 경우)

```bash
# 1) 홈 아래에 설치 디렉터리 생성
mkdir -p ~/opt
cd ~/opt

# 2) Node 20 LTS 다운로드
curl -O https://nodejs.org/dist/v20.17.0/node-v20.17.0-linux-x64.tar.xz

# 3) 압축 풀기
tar -xf node-v20.17.0-linux-x64.tar.xz
mv node-v20.17.0-linux-x64 node-20

# 4) PATH 영구 반영
echo 'export PATH="$HOME/opt/node-20/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 5) 정상 설치 확인
node --version    # → v20.17.0
npm --version     # → 10.x.x
which node        # → /home/<user>/opt/node-20/bin/node
```

`which node` 결과가 `$HOME` 아래 경로로 나오면 시스템을 건드리지 않은 상태입니다.

### 1.2 인터넷이 차단된 경우 (사내망)

1. 인터넷이 되는 Mac 또는 오피스 PC에서 먼저 다운로드:
   ```bash
   curl -O https://nodejs.org/dist/v20.17.0/node-v20.17.0-linux-x64.tar.xz
   ```
2. USB / Samba 공유 / SCP 등으로 타깃 서버의 `~/opt/` 로 복사
3. 1.1 절차의 3)번부터 이어서 실행

### 1.3 제거 방법

```bash
rm -rf ~/opt/node-20
# 그리고 ~/.bashrc 에서 추가했던 PATH 라인 한 줄 삭제
```

### 1.4 아키텍처 / OS 호환성 참고

- CPU 확인: `uname -m` → `x86_64` 이면 위의 `linux-x64` tarball 사용
- ARM이면 `linux-arm64` 버전 다운로드 필요
- 매우 오래된 OS(RHEL 7 계열, glibc 2.17)에서는 Node 20이 동작하지 않을 수 있음
  - 확인: `ldd --version` → glibc 2.28 이상 권장
  - OS 확인: `cat /etc/os-release`

---

## 2. Docker Compose v2 설치 (플러그인 방식)

Docker 20.10.12 는 Compose v2 플러그인을 지원합니다. 사용자 홈의 `~/.docker/cli-plugins/` 디렉터리에 바이너리 하나만 놓으면, `docker compose` 서브커맨드가 자동으로 활성화됩니다. **기존 Docker 바이너리나 설정을 전혀 건드리지 않습니다.**

### 2.1 설치 절차 (인터넷이 되는 경우)

```bash
# 1) 플러그인 디렉터리 생성
mkdir -p ~/.docker/cli-plugins

# 2) Compose v2 바이너리 다운로드 (Linux x86_64 기준)
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose

# 3) 실행 권한 부여
chmod +x ~/.docker/cli-plugins/docker-compose

# 4) 정상 설치 확인
docker compose version
# → Docker Compose version v2.29.7
```

### 2.2 원리 요약

`docker` CLI는 실행 시 `~/.docker/cli-plugins/` 디렉터리를 자동 스캔해서 발견되는 바이너리를 서브커맨드로 등록합니다. 그래서 `docker compose ...` 명령이 자동으로 연결됩니다. 시스템 Docker 설정 파일을 수정할 필요가 없습니다.

### 2.3 인터넷이 차단된 경우

1. 인터넷 되는 PC에서:
   ```bash
   curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
     -o docker-compose
   ```
2. USB/Samba로 타깃 서버 `~/.docker/cli-plugins/docker-compose` 위치에 복사
3. `chmod +x ~/.docker/cli-plugins/docker-compose`

### 2.4 제거 방법

```bash
rm ~/.docker/cli-plugins/docker-compose
```

### 2.5 아키텍처별 파일명

- x86_64(인텔/AMD): `docker-compose-linux-x86_64`
- ARM64(Graviton, 라즈베리파이 등): `docker-compose-linux-aarch64`

`uname -m` 결과로 판단하세요.

---

## 3. Docker 사용 권한 확인 (중요)

사용자가 `sudo` 없이 Docker를 쓸 수 있어야 DCIM 설치를 진행할 수 있습니다.

```bash
docker ps
```

- 정상 출력되면 OK, 바로 4번 진행
- `permission denied while trying to connect to the Docker daemon socket` 에러가 나오면 현재 사용자가 `docker` 그룹에 속해있지 않은 것입니다.

### 3.1 docker 그룹 추가 (시스템 관리자 협조 필요)

이 부분만 시스템 변경이 필요합니다. 관리자에게 다음을 요청하세요:

> "내 계정(`<사용자명>`)을 `docker` 그룹에 추가해 주세요. `sudo usermod -aG docker <사용자명>` 한 줄이면 됩니다. 기존 Docker 엔진 설정이나 다른 사용자는 영향받지 않습니다."

추가 후 **재로그인** 하면 `docker ps`가 권한 없이 동작합니다.

---

## 4. 전체 설치 순서 요약 (Copy & Paste용)

**인터넷이 되는 경우 한 번에 실행**:

```bash
# ── Node.js ──────────────────────────────
mkdir -p ~/opt && cd ~/opt
curl -O https://nodejs.org/dist/v20.17.0/node-v20.17.0-linux-x64.tar.xz
tar -xf node-v20.17.0-linux-x64.tar.xz
mv node-v20.17.0-linux-x64 node-20
echo 'export PATH="$HOME/opt/node-20/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
node --version && npm --version

# ── Docker Compose v2 ────────────────────
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version

# ── Docker 권한 확인 ─────────────────────
docker ps
# 권한 에러면 관리자에게 docker 그룹 추가 요청
```

---

## 5. 설치 후 확인 체크리스트

- [ ] `node --version` → v20.x 출력
- [ ] `npm --version` → 10.x 출력
- [ ] `which node` 경로가 `$HOME/opt/node-20/...` 아래인가
- [ ] `docker compose version` → v2.29.7 출력
- [ ] `docker ps` sudo 없이 실행되는가
- [ ] 기존 Docker 컨테이너들이 여전히 정상 동작하는가 (`docker ps -a` 로 확인)

모두 OK면 다음 단계(`office-setup-guide-20260413.md`의 2.3 `.env` 작성부터)로 진행할 수 있습니다.

---

## 6. 트러블슈팅

| 증상 | 원인 / 대응 |
|------|-------------|
| `node: /lib64/libm.so.6: version GLIBC_2.28 not found` | OS의 glibc가 너무 낮음. RHEL 7 계열일 가능성. → Node 18의 특정 빌드 또는 시스템 업그레이드 필요. 관리자 문의. |
| `tar: xz: Cannot exec` | xz 유틸이 없음. `.tar.gz` 버전을 대신 받아서 `tar -xzf` 로 해제. |
| `docker compose version` 시 "docker: 'compose' is not a docker command" | 바이너리 위치 또는 권한 문제. `ls -la ~/.docker/cli-plugins/docker-compose` 로 실행 권한 확인. |
| `curl: (6) Could not resolve host: nodejs.org` | 사내망 DNS/프록시 차단. → 1.2 또는 2.3의 오프라인 전달 방식 사용. |
| `PATH` 를 수정했는데 반영 안 됨 | 새 쉘을 열거나 `source ~/.bashrc` 실행. `zsh` 쓰면 `~/.zshrc`에 추가. |

---

작성일: 2026-04-13
