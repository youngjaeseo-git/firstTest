# 20260625.sh 실행 결과 (2026-06-25)

## C1: ipAddress 누락 Lab-3 장비

| id | hostname | ipAddress |
|----|----------|-----------|
| cmovbwowy000naevd27sf7fck | s222hax14ae011 | 10.144.38.61 |
| cmovbwpv9000qaevdmp8n7jdf | s222hax14ae012 | 10.144.38.62 |

**분석**: 이 2대는 Lab-3 장비가 아닌 **Lab-1 장비**. hostname이 `s222h%` 패턴에 매칭되지만 IP가 `10.144.38.x` (Lab-1 대역). infrastructure.md에도 Lab-1 서버로 기록됨. Lab-3 장비 24대는 모두 정상적으로 `10.144.131.x` IP 등록됨.

**결론**: ipAddress 누락 없음. 수정 불필요.

## C2: WorkloadProject 테이블

- **결과**: `relation "WorkloadProject" does not exist`
- Prisma 스키마에 해당 모델 없음 (EvalProject만 존재)

## C3: WorkloadProject 컬럼

- **결과**: no data (테이블 미존재)

## C4: Phase 관련 테이블

- **결과**: `EvalPhase` 테이블 존재 (Phase 아님)

## C5: Phase 샘플

- **결과**: NO_PHASE_TABLE (쿼리가 "Phase"를 조회 — 실제 이름은 "EvalPhase")
- EvalPhase 데이터 존재 여부는 미확인

## C6: Step/Task 관련 테이블

- **결과**: `EvalTask` 테이블 존재

## C7: YAML/config/step 컬럼

- **결과**: no data (WorkloadProject 미존재)

## C8: kube_pod_info 라벨 키

```
__name__, created_by_kind, created_by_name, host_ip, instance, job, namespace, node, pod, pod_ip, uid
```

**주목할 라벨**:
- `created_by_kind`: Pod를 생성한 리소스 종류 (Deployment, Job, DaemonSet 등)
- `created_by_name`: Pod를 생성한 리소스 이름
- `host_ip`: Pod가 실행 중인 노드 IP
- `node`: 노드 hostname

## 종합

1. Lab-3 ipAddress 누락 없음 (2대는 Lab-1 서버)
2. DB에 WorkloadProject 테이블 없음 — EvalProject/EvalPhase/EvalTask만 존재
3. 워크로드 스텝 기능은 기존 Eval* 모델 기반으로 구현
4. kube_pod_info에서 `created_by_kind`/`created_by_name`으로 워크로드 유형 식별 가능
