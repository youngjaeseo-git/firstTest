# Bulk HW Refresh 진행 상황 (2026-06-25)

## 목표
30대 서버의 CPU/Memory/BIOS 데이터 채우기 (현재: CPU=7, MEM=10, BIOS=9)

## 시도 이력

| # | 방식 | 결과 | 실패 원인 |
|---|------|------|-----------|
| 1 | fix-server-data.sh: curl → API (username=admin) | OK=0 FAIL=0 | CSRF 토큰 누락 + email이 아닌 username 사용 |
| 2 | bulk-refresh.sh v1: 호스트에서 npx tsx 직접 실행 | 30대 전부 FAIL | 호스트 → BMC IP(192.168.10.x) 네트워크 불가 (curl 000) |
| 3 | bulk-refresh.sh v2: curl → API (CSRF + email 수정) | 아직 미실행 | — |

## 확인된 사실
- 호스트에서 BMC IP(192.168.10.x)에 **직접 접근 불가** (curl HTTPS/HTTP 둘 다 000)
- 웹앱은 Room의 `bmcProxyUrl` (예: http://10.144.131.100:8443) 경유해야 BMC 접근 가능
- 기존 7대 성공은 웹앱(K8s pod) 내부에서 프록시를 통해 실행된 것
- BMC 인증: .env에 BMC_USERNAME(6자)/BMC_PASSWORD(10자) 설정됨
- K8s pod/Docker app 컨테이너: 호스트에서 찾을 수 없음 (kubectl, docker ps 모두)

## 서버에서 확인해야 할 것 (우선순위순)

### 1. Rack→Room→bmcProxyUrl 체인 확인
- 30대 서버가 모두 Rack → Room → bmcProxyUrl 연결이 되어 있는지
- 스크립트 실행하면 `CHAIN: TOTAL=30 NO_PROXY=?`로 확인 가능
- NO_PROXY > 0이면 해당 장비의 Rack/Room 연결 수정 필요

### 2. 앱 접근 경로 확인
- `http://localhost:3000`으로 호스트에서 웹앱에 접근 가능한지
- K8s NodePort, port-forward, 또는 다른 주소일 수 있음
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → 200이면 OK

### 3. API 방식 실행
- 위 2가지 확인 후 `bash check/targetExecCmd/20260625-bulk-refresh.sh` 실행
- CSRF=OK → LOGIN=200/302 → SESSION=admin@dcim.local 순서로 진행되어야 함

### 4. API 실패 시 대안
- `kubectl exec`로 웹앱 pod 내부에서 직접 실행하는 방식
- pod 이름 확인: `kubectl get pods | grep dcim`
- pod 내부에서는 BMC 프록시 경유 가능

## 관련 파일
- 스크립트: `check/targetExecCmd/20260625-bulk-refresh.sh` (v2, API 방식)
- 디버그: `check/targetExecCmd/20260625-debug-refresh.sh`, `20260625-debug-bmc-auth.sh`
- 데이터 현황: `check/results/20260625-server-data.md`
- BMC 프록시 설정: Room 테이블의 bmcProxyUrl 컬럼
- API 라우트: `src/app/api/equipment/bulk-bmc/route.ts`
