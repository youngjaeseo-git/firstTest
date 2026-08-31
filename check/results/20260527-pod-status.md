# 2026-05-27 Pod 상태 메트릭 확인

## 출처: check/targetExecCmd/20260527.sh 실행 결과

### 1. 워크로드 Pod phase (kube_pod_status_phase==1)
| namespace | pod | phase |
|-----------|-----|-------|
| cmx-acc-acstress | stress-sat-76d6cb5545-k5bmq | Running |
| cmx-acc-acstress | stress-sat-76d6cb5545-vcxfk | Running |
| cmx-acc-lc32g-tencent-lrr | sleep-deploy-f4c8d7bc6-zdsgs | Running |
| cmx-acc-vrt | stress-sat-84677cb6c4-x5cvj | Running |
| cmx-acc-qual-sp16g-1st-ber-eccoff | stress-sat-7c696d98f4-4hs5r | Running |
| cmx-qual-24g-ber-no23 | stress-sat-779b584db-dfj6t | Running |
| cmx-qual-24g-ber-no4 | stress-sat-84d469589f-fwltw | Pending |
| cmx-smc-lclife | stress-sat-74b5fd7799-mt4ss | Pending |
| cmx-smc-lcrpime | stress-prime-85bf8d99b7-7jj4t | Pending |
| default | hello-world-pod4 | Succeeded |
| default | test-pod | Succeeded |

### 2. kube_pod_status_phase 라벨 구조
- 965 series 전체 (시스템 포함)
- labels: __name__, instance, job, phase, namespace, pod
- phase 값: Running, Pending, Succeeded, Failed

### 3. Container waiting reason (워크로드만)
| namespace | pod | reason |
|-----------|-----|--------|
| cmx-acc-acstress | stress-sat-76d6cb5545-k5bmq | ImagePullBackOff |

### 4. 사용 가능한 pod status 메트릭
- kube_pod_container_info
- kube_pod_container_resource_limits / requests (cpu, memory)
- kube_pod_container_status_last_terminated_reason
- kube_pod_container_status_ready
- kube_pod_container_status_restarts_total
- kube_pod_container_status_running
- kube_pod_container_status_terminated / terminated_reason
- kube_pod_container_status_waiting / waiting_reason
