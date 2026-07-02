# 보안 · 권한(RBAC) 모델 (DC Express — DCIM)

> 2026-07-02 기준. 인증·인가·조직 격리·감사의 실제 구현을 한곳에 정리한 보안 산출물.
> 근거 코드: `src/middleware.ts`, `src/lib/rbac.ts`, `src/lib/auth.ts`, `src/lib/cron-auth.ts`, `src/lib/audit.ts`.
> 권한 액터/유즈케이스 관점은 `docs/uml-diagrams.md §1`, 발견된 허점은 `§5` 참조.

---

## 1. 인증(Authentication)

- **방식**: NextAuth.js `CredentialsProvider` + **JWT 세션 전략**. 비밀번호는 bcrypt 해시(`User.password`).
- **가입 승인**: `User.approved` 플래그 — 관리자가 승인해야 로그인 가능.
- **경계 강제(middleware)**: `src/middleware.ts`가 모든 요청에서 JWT 토큰을 검사.
  - 토큰 없음 + `/api/*` → `401 JSON`
  - 토큰 없음 + 페이지 → `/login?callbackUrl=...` 리다이렉트
  - **예외(matcher 제외)**: `login`, `signup`, `api/auth`, `api/cron`, 정적 자원.
    → `api/cron`은 사용자 세션이 아니라 **CRON_SECRET**으로 별도 인증(§4).

> ⚠️ middleware는 "로그인 여부"만 검사한다. **역할(Role) 검사는 각 API 라우트의 책임**이다(§3).

---

## 2. 역할(Role)과 권한 함수

역할은 3단계(`prisma/schema.prisma` `enum Role`): **ADMIN ⊃ OPERATOR ⊃ VIEWER**.

`src/lib/rbac.ts`의 권한 판정 함수:

| 함수 | ADMIN | OPERATOR | VIEWER | 용도 |
|------|:---:|:---:|:---:|------|
| (조회 GET) | ✅ | ✅ | ✅ | 모든 인증 사용자 읽기 가능(단, 조직 격리 §5) |
| `canEdit` | ✅ | ✅ | ❌ | 생성·수정(POST/PUT/PATCH) |
| `canChangeStatus` | ✅ | ✅ | ❌ | 라이프사이클 상태 변경 |
| `canControlPower` | ✅ | ✅ | ❌ | BMC 전원 제어(파괴적) |
| `canAcknowledgeAlert` | ✅ | ✅ | ❌ | 알림 확인(ack) |
| `canDelete` | ✅ | ❌ | ❌ | 삭제(파괴적) |
| `canManageUsers` | ✅ | ❌ | ❌ | 사용자·역할 관리 |
| `isAdmin` | ✅ | ❌ | ❌ | 관리 전용 기능 |

**표준 가드 패턴**(라우트에서):
```ts
const user = await getSessionUser();
if (!user || !canEdit(user.role)) {
  return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
}
```

---

## 3. 기능별 권한 매트릭스

| 도메인 / 액션 | VIEWER | OPERATOR | ADMIN |
|------|:---:|:---:|:---:|
| 대시보드·모니터링·메트릭 조회 | ✅ | ✅ | ✅ |
| 장비 생성/수정 | ❌ | ✅(소속 org) | ✅(전체) |
| 장비 삭제 | ❌ | ❌ | ✅ |
| 장비 상태 변경(라이프사이클) | ❌ | ✅(소속 org) | ✅ |
| BMC 전원 제어 | ❌ | ✅(소속 org) | ✅ |
| 장비 할당(assignment) 생성/해제 | ❌ | ✅(소속 org) | ✅ |
| DIMM/메모리 수정 | ❌ | ✅(소속 org) | ✅ |
| 랙·룸·Digital Twin 편집 | ❌ | ✅ | ✅ |
| 평가(Evaluations)·워크로드 생성/수정 | ❌ | ✅ | ✅ |
| 평가 프로젝트 삭제 | ❌ | ❌ | ✅ |
| 평가 하위(phase/task/note/result) 편집·삭제 | ❌ | ✅ | ✅ |
| 알림 확인(ack) | ❌ | ✅ | ✅ |
| 알림 규칙·채널·에스컬레이션 관리 | ❌ | ✅ | ✅ |
| Prometheus 타겟 등록 | ❌ | ✅ | ✅ |
| Prometheus 타겟 해제 | ❌ | ❌ | ✅ |
| 감사로그 조회 | ✅ | ✅ | ✅ |
| 감사로그 내보내기(export) | ❌ | ❌ | ✅ |
| 사용자·역할 관리 | ❌ | ❌ | ✅ |

> 일부 비대칭(등록=OPERATOR/해제=ADMIN, 조회=전원/내보내기=ADMIN)은 의도된 최소권한이지만 정합성 검토 대상(§5의 S6~S8).

---

## 4. 조직 격리(Multi-tenancy)

비-ADMIN 사용자는 **자신이 속한 조직(`user.orgIds`)의 장비에만** 접근한다.

- **목록 필터**: `equipmentOrgFilter(user)` / `buildOrgWhere(user, where)` → Prisma `where`에 `organizationId in orgIds` 주입(ADMIN은 무제한).
- **단건 접근**: 장비 하위 라우트(status/history/power/memory/refresh-hw/assignments/sensors)는
  `user.role !== "ADMIN" && (!eq.organizationId || !user.orgIds.includes(eq.organizationId))` → `403`.
  - **org 미배정(null) 장비는 비-ADMIN에게 차단**(v0.9 보안 수정에서 통일).

---

## 5. Cron / 시스템 인증

`api/cron/*`는 사용자 세션이 없으므로 `CRON_SECRET`으로 인증(`src/lib/cron-auth.ts` 공통 헬퍼):

- **Bearer 헤더 전용**: `Authorization: Bearer THE_SECRET`. **URL `?key=` 방식은 제거**(액세스 로그 노출 방지).
- **상수시간 비교**: `crypto.timingSafeEqual`로 타이밍 사이드채널 차단.
- **미설정 시 비활성**: `CRON_SECRET` 없으면 `503`(무인증 트리거 방지).

---

## 6. 감사(Audit)

- `logAudit()`가 파괴적/중요 작업(CREATE/UPDATE/DELETE/STATUS_CHANGE/POWER_ACTION)을 `AuditLog`에 기록.
- `reason`(왜)·`ticketRef`(외부 티켓)을 함께 남길 수 있음.
- **한계(§5 S14)**: audit write는 호출자를 깨지 않도록 실패해도 무시(catch) → "항상 기록" 보장은 아님. write-audit-first가 아님 → v1.0 검토.

---

## 7. 보안 허점 조치 현황 (2026-07-02)

UML 작성 중 발견한 권한/보안 허점(`docs/uml-diagrams.md §5`, 전체 S1~S19) 중 우선순위:

| # | 내용 | 상태 |
|---|------|------|
| S1 | 평가·워크로드 쓰기 API 역할 체크 전무(VIEWER 쓰기) | ✅ 수정(canEdit/canDelete 가드) |
| S2 | 장비 할당 쓰기 역할 체크 없음 | ✅ 수정(canEdit) |
| S4 | 메트릭 프록시 임의 PromQL·무제한 range·public 캐시 | ✅ 경량 하드닝(캡+private). 화이트리스트 v1.0 |
| S5 | CRON_SECRET `?key=` 수용·비-timing-safe | ✅ 수정(Bearer 전용·timingSafeEqual) |
| S17 | 메트릭 응답 `Cache-Control: public` | ✅ 수정(private) |
| S3 | 알림 목록 org 필터 없음 | ⏳ v1.0(스키마에 organizationId 부재) |
| S6~S16, S18~S19 | 권한 비대칭·알림 엔진 관측성·감사 처리 등 | 📋 `uml-diagrams.md §5` |

---

> 💡 권한 함수·조직 격리·매트릭스는 변경 시 이 문서와 `docs/uml-diagrams.md §1`(권한 매트릭스)를 함께 갱신할 것.
