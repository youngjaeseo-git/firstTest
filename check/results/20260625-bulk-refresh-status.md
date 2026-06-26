# Bulk HW Refresh 진행 상황 (2026-06-25 ~ 06-26)

## 목표
30대 서버의 CPU/Memory/BIOS 데이터 채우기

## 최종 결과 (2026-06-26)

**OK=23 / FAIL=7** (성공률 77%)

### 실패 서버 상세

| 유형 | 서버 | BMC IP | 원인 | 대수 |
|------|------|--------|------|------|
| HTTP 502 | (미상) | — | failed to enumerate systems — BMC 펌웨어 또는 프록시 문제 | 4 |
| EHOSTUNREACH | (미상) | 192.168.1.x | BMC IP 도달 불가 — 네트워크 경로 또는 BMC 미응답 | 2 |
| Timeout | s222hax14ae006 | 192.168.10.106 | 프록시 경유 접속 시 15초 타임아웃 초과 | 1 |

### 변경 전후 비교

| 항목 | 변경 전 (06-26 아침) | 변경 후 (06-26 벌크 리프레시) |
|------|---------------------|------------------------------|
| CPU 데이터 | 7대 | 23대+ |
| MEM 데이터 | 10대 | 23대+ |
| BIOS 데이터 | 9대 | 23대+ |

---

## 트러블슈팅 히스토리 (6일간, 5회 시도)

### 시도 1 — fix-server-data.sh (06-25)
- **방식**: curl → API (username=admin)
- **결과**: OK=0 FAIL=0 (응답 자체가 없음)
- **원인**: CSRF 토큰 누락 + NextAuth는 email 기반인데 username으로 로그인 시도

### 시도 2 — bulk-refresh.sh v1 (06-25)
- **방식**: 호스트에서 `npx tsx` 직접 실행 (API 우회, Prisma 직접 호출)
- **결과**: 30대 전부 FAIL
- **원인**: 호스트 → BMC IP(192.168.10.x) 네트워크 직접 접근 불가. BMC는 Room의 `bmcProxyUrl` 경유해야만 접근 가능한 구조

### 시도 3 — bulk-refresh.sh v2 (06-25)
- **방식**: curl → 웹앱 API (CSRF + email 수정)
- **결과**: 미실행 — 8-agent 리뷰로 코드 문제 먼저 수정 결정

### 시도 4 — 8-agent 코드 리뷰 + 수정 후 실행 (06-26)
- **방식**: API 코드 6개 이슈 수정 후 스크립트 실행
- **결과**: `ERR: 앱 접근 불가` — 스크립트가 HTTP 307을 유효 응답으로 인식하지 못함
- **원인**: NextAuth가 미인증 요청에 307 리다이렉트 반환. 스크립트는 200/302만 체크

### 시도 5 — 307 수정 후 재실행 (06-26)
- **방식**: 307을 유효 코드로 추가 후 재실행
- **결과**: `ERR: 로그인 실패` — 로그인 200 반환했지만 세션이 빈 것으로 판정
- **원인**: `json_val email`의 python3 경로가 NextAuth 세션 응답의 중첩 구조를 처리 못함
  - 세션 응답: `{"user":{"email":"admin@dcim.local",...}}` (email이 user 안에 중첩)
  - `json.load(sys.stdin).get('email','')` → 최상위에 email 없음 → 빈 문자열
  - 실제로는 로그인 성공했지만, 파싱 실패로 "로그인 실패"로 오판

### 시도 6 — 세션 파싱 수정 후 최종 실행 (06-26) ✅
- **방식**: 세션 확인을 `user.email`로 중첩 파싱하도록 수정
- **결과**: **OK=23 / FAIL=7** — 성공

---

## 해결하기 어려웠던 근본 원인 분석

### 1. 다층 문제가 겹쳐 있었다 (Layered Problems)

한 번에 하나가 아니라 **여러 레이어의 문제가 동시에 존재**해서, 하나를 고치면 다음 문제가 드러나는 구조였다:

```
Layer 1: API 코드 — $transaction 미사용, totalMemoryGiB 타입 불일치, 프록시 가드 없음
Layer 2: 스크립트 — HTTP 307을 유효 응답으로 미인식
Layer 3: 스크립트 — NextAuth 세션 응답의 중첩 JSON 파싱 실패
Layer 4: 인프라 — BMC 네트워크 직접 접근 불가 (프록시 필수)
```

### 2. 폐쇄망 환경의 디버깅 난이도

- 사용자가 **화면 출력을 눈으로 보고 직접 타이핑**해야 하므로 디버깅 정보가 제한적
- 에러 메시지를 정확히 전달받기 어려워 추측에 의한 수정 → 재시도 사이클
- git push → 서버 pull → 실행 → 결과 타이핑의 **느린 피드백 루프**

### 3. NextAuth의 불투명한 에러 처리

- `authorize()` 실패 시 HTTP 200 반환 (401/403이 아님) → 성공/실패 구분 어려움
- 세션 응답의 중첩 구조 (`{"user":{"email":...}}`)가 단순 key-value 파싱을 무력화
- 307 리다이렉트가 "앱이 살아있다"의 증거인데 스크립트는 "앱 접근 불가"로 판정

### 4. BMC 네트워크 토폴로지 복잡성

- BMC IP(192.168.10.x)는 **앱 서버에서 직접 도달 불가** — Room의 bmcProxyUrl 경유 필수
- Lab-1 서버(10.x.x.x BMC)는 프록시 없이 직접 접근 가능 → 일률적 가드 불가
- 프록시가 없는 서버를 단순 차단하면 Lab-1 6대가 불필요하게 차단됨

---

## 적용된 수정 사항 (8-agent 리뷰 기반)

| ID | 이슈 | 수정 내용 |
|----|------|-----------|
| C1 | bmcProxyUrl 없는 서버 → 무조건 직접 접근 시도 | 192.168.x.x만 프록시 필수, 10.x.x.x는 직접 허용 |
| C2 | saveHwInfo deleteMany+createMany 트랜잭션 없음 | `prisma.$transaction()` 래핑 |
| H1 | json_val grep 폴백 숫자값 미지원 | 문자열+숫자 모두 파싱 |
| H2 | curl HTTP 상태 코드 미체크 | 상태 코드 + 빈 응답 가드 추가 |
| H3 | totalMemoryGiB float → Int | `Math.round()` 적용 |
| M2 | curl -L 플래그 누락 | 추가 |
| — | HTTP 307 미인식 | 유효 코드로 추가 |
| — | 세션 JSON 중첩 파싱 | `user.email` 직접 추출 |

## 관련 파일

| 파일 | 용도 |
|------|------|
| `src/app/api/equipment/bulk-bmc/route.ts` | Bulk BMC API (C1/C2/H3 수정) |
| `check/targetExecCmd/20260625-bulk-refresh.sh` | 벌크 리프레시 실행 스크립트 |
| `check/targetExecCmd/20260626-fix-approved.sh` | approved 필드 수정 (결과적으로 불필요했음) |
| `check/targetExecCmd/20260626.sh` | 환경 진단 스크립트 |
| `check/results/20260626-env-diag.md` | 환경 진단 결과 |
| `prisma/seed.ts` | admin 유저 approved=true 추가 |
