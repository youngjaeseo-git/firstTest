# 데이터 모델 ERD (DC Express — DCIM)

> `prisma/schema.prisma` 기준 (2026-07-02, 29개 모델 · 13개 enum). GitHub에서 Mermaid로 렌더된다.
> UML 범위(유즈케이스·액티비티·시퀀스)와 별개인 **데이터 모델링 산출물**이다.
> 필드 전체가 아니라 **PK/FK + 식별에 필요한 핵심 필드**만 표기했다. 전체 컬럼은 `schema.prisma` 참조.

---

## 1. 물리 계층 · 자산 (DataCenter → Room → Rack → Equipment)

```mermaid
erDiagram
    DataCenter ||--o{ Room : "rooms"
    Room ||--o{ Rack : "racks"
    Room ||--o{ RoomElement : "elements(냉각/PDU/스위치)"
    Rack ||--o{ Equipment : "equipment"
    Rack ||--o{ PDU : "pdus"
    Organization ||--o{ Equipment : "owns(조직격리)"
    Equipment ||--o{ EquipmentCpu : "cpus"
    Equipment ||--o{ EquipmentMemory : "memories(DIMM)"
    Equipment ||--o{ NetworkPort : "networkPorts"
    Equipment ||--o| PrometheusTarget : "1:1 링크"
    Equipment ||--o{ EquipmentAssignment : "assignments"

    DataCenter {
        string id PK
        string name
        string location
    }
    Room {
        string id PK
        string dataCenterId FK
        string name
        int layoutX_Y_W_H "Digital Twin 좌표"
        string bmcProxyUrl
    }
    RoomElement {
        string id PK
        string roomId FK
        string type "COOLING/PDU/SWITCH/MASTER_SERVER"
        int positionX_Y
    }
    Rack {
        string id PK
        string roomId FK
        string name
        int totalUnits "기본 42U"
        int maxPowerWatts
    }
    Equipment {
        string id PK
        string rackId FK "SetNull"
        string organizationId FK "SetNull"
        string hostname
        string ipAddress
        enum type "EquipmentType"
        enum status "EquipmentStatus(9단계)"
        string bmcIpAddress
        string prometheusInstance "legacy 라벨"
    }
    EquipmentCpu {
        string id PK
        string equipmentId FK
        int socketIndex "UQ(eq,socket)"
        string model
        int cores_threads
    }
    EquipmentMemory {
        string id PK
        string equipmentId FK
        int slotIndex "UQ(eq,slot)"
        string slotName "DIMM_A1 등"
        enum memoryType "MemoryType"
        float capacityGb
    }
    NetworkPort {
        string id PK
        string equipmentId FK
        string speed "1G/10G/25G/100G"
    }
    PDU {
        string id PK
        string rackId FK
        float maxAmps
    }
    PrometheusTarget {
        string id PK
        string equipmentId FK "UQ,SetNull"
        string instance "UQ, ip:port"
        string job
        string health
    }
    EquipmentAssignment {
        string id PK
        string equipmentId FK
        string assignedTo
        datetime releasedAt "null=사용중"
    }
```

---

## 2. 인증 · 조직 · 감사 (User / Organization / AuditLog)

```mermaid
erDiagram
    User ||--o{ Account : "accounts"
    User ||--o{ Session : "sessions"
    User ||--o{ UserOrganization : "memberships"
    Organization ||--o{ UserOrganization : "members"
    User ||--o{ AuditLog : "auditLogs"
    User ||--o{ AlertAcknowledgement : "alertAcks"

    User {
        string id PK
        string email UK
        string password "bcrypt"
        enum role "ADMIN/OPERATOR/VIEWER"
        boolean approved
    }
    Organization {
        string id PK
        string name UK
    }
    UserOrganization {
        string userId FK "PK(복합)"
        string organizationId FK "PK(복합)"
        enum role
    }
    Account {
        string id PK
        string userId FK
        string provider "UQ(provider,accountId)"
    }
    Session {
        string id PK
        string userId FK
        string sessionToken UK
    }
    AuditLog {
        string id PK
        string userId FK
        string action "CREATE/UPDATE/DELETE/POWER_ACTION"
        string entityType
        string entityId
        json changes
        string reason "파괴적 작업 시 필수"
    }
```

---

## 3. 알림 · 알림 파이프라인 (AlertRule / Alert / 채널 / 에스컬레이션)

```mermaid
erDiagram
    AlertRule ||--o{ Alert : "alerts"
    Alert ||--o{ AlertAcknowledgement : "acknowledgement"
    User ||--o{ AlertAcknowledgement : "user"
    NotificationChannel ||--o{ EscalationPolicy : "escalations"

    AlertRule {
        string id PK
        string metric "PromQL"
        string condition "예: > 80"
        int duration "seconds(현재 미평가·이슈)"
        enum severity "AlertSeverity"
        boolean enabled
    }
    Alert {
        string id PK
        string ruleId FK "nullable"
        enum status "FIRING/ACKNOWLEDGED/RESOLVED"
        enum severity
        string source "서버 식별자(org필드 없음·S3)"
        datetime firedAt
        datetime resolvedAt
    }
    AlertAcknowledgement {
        string id PK
        string alertId FK
        string userId FK
        datetime ackedAt
    }
    NotificationChannel {
        string id PK
        string type "EMAIL/SLACK/TEAMS/WEBHOOK"
        string target
        enum minSeverity
    }
    EscalationPolicy {
        string id PK
        string channelId FK "SetNull"
        enum severity
        int afterMinutes
    }
    MaintenanceWindow {
        string id PK
        string targetType "all/source/category"
        string targetValue
        datetime startTime_endTime
    }
```

> **참고**: `MaintenanceWindow`는 FK 관계 없이 `targetType`/`targetValue`로 알림을 문자열 매칭 억제한다. `Alert`에 `organizationId`가 없어 조직별 필터가 불가(설계 허점 S3 → v1.0 이월, `docs/uml-diagrams.md §5`).

---

## 4. 메모리 평가 · 워크로드 (EvalProject 하위)

```mermaid
erDiagram
    EvalProject ||--o{ EvalPhase : "phases"
    EvalProject ||--o{ EvalResult : "results"
    EvalProject ||--o{ EvalTask : "tasks"
    EvalProject ||--o{ EvalNote : "notes"
    EvalPhase ||--o{ EvalResult : "results"
    EvalPhase ||--o{ EvalTask : "tasks"
    Equipment ||--o{ EvalResult : "evalResults"

    EvalProject {
        string id PK
        string title
        enum evalType "FIELD/ACCELERATED"
        enum status "PLANNED..CANCELLED"
        string namespace "K8s 워크로드 연결"
        string createdBy
    }
    EvalPhase {
        string id PK
        string projectId FK
        enum status "EvalPhaseStatus"
        int sortOrder
        json config
    }
    EvalResult {
        string id PK
        string projectId FK
        string phaseId FK "nullable"
        string equipmentId FK "nullable"
        enum result "PASS/FAIL/WARNING/RUNNING/PENDING"
        string testedBy
    }
    EvalTask {
        string id PK
        string projectId FK
        string phaseId FK "nullable"
        enum status "TODO/IN_PROGRESS/DONE/BLOCKED"
        enum priority "LOW..URGENT"
    }
    EvalNote {
        string id PK
        string projectId FK
        string content
    }
```

---

## 5. 독립 모델 · 참조 무결성 요약

| 모델 | 관계 | 비고 |
|------|------|------|
| `ExpiryTracker` | 관계 없음(독립) | 인증서·라이선스·보증 만료 추적. `source` 문자열로 대상 식별 |
| `MaintenanceWindow` | 관계 없음(독립) | 알림 억제 창. `targetType`/`targetValue` 문자열 매칭 |
| `AuditLog` | `User`만 FK | `entityType`/`entityId`로 임의 엔티티 참조(polymorphic, FK 아님) |

### onDelete 정책 (데이터 안전성)
- **Cascade**(부모 삭제 시 자식 삭제): Room→Rack/Element, Rack→PDU, Equipment→Cpu/Memory/NetworkPort/Assignment, EvalProject→Phase/Result/Task/Note, User→Account/Session/UserOrg, Alert→Acknowledgement
- **SetNull**(부모 삭제 시 FK만 null): Equipment.rackId, Equipment.organizationId, PrometheusTarget.equipmentId, EscalationPolicy.channelId
  - → 랙/조직/장비를 지워도 하위 레코드는 보존되고 링크만 끊긴다(자산 이력 보호).
- **명시 정책 없음(기본 제한)**: Alert.ruleId(nullable), EvalResult.phaseId/equipmentId(nullable) 등은 nullable로 두어 참조 대상 삭제와 무관하게 유지.

---

> 💡 스키마 변경 시 이 문서와 `docs/uml-diagrams.md`(권한 매트릭스), `docs/features.md`를 함께 갱신할 것.
