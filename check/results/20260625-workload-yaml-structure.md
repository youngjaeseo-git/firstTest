# 워크로드 스크립트 구조 (2026-06-25 사용자 제공)

## .f 파일 구조 (ex.f — 워크로드 스크립트 기술문서)

워크로드 요소를 구성하고 수행할 순서와 반복을 정의하는 파일.

### 글로벌 설정 (Start 섹션)
```
Start
DEFAULT_VDD = 1100mv
MAX_RETRY = 5
FDLY = 5ms
TM_ENTRY = 0xA, 0xB, 0xC, 0xD
ECC_OFF = 0x81, 0xB2
```

### Step 정의
```
Step:1
Name = ECC_OFF
Test Mode = ECC_OFF
Page Policy = close
KEEP_TM = 1
Reboot
Workload = sat.yaml
LABEL = stress (0)
Test Time = 12d

Step:2
Name = VBBW_1DN
Test Mode = VBBW_1DN
Page Policy = close
RAS Mode = Indep
Reboot
Workload = prime.yaml sat.yaml
LABEL = stress(0)
Test Time = 12d
```

### Step 필드 설명
| 필드 | 설명 | 예시 |
|------|------|------|
| Name | 스텝 식별자 | ECC_OFF, VBBW_1DN |
| Test Mode | 테스트 모드 설정 | ECC_OFF, VBBW_1DN |
| Page Policy | 메모리 페이지 정책 | close |
| RAS Mode | RAS 모드 (선택) | Indep |
| KEEP_TM | 테스트 모드 유지 플래그 | 1 |
| Reboot | 스텝 실행 전 리부트 | (플래그) |
| Workload | K8s YAML 파일 목록 | sat.yaml, prime.yaml sat.yaml |
| LABEL | 서버 리스트 선택자 | stress(0) = 0번 서버, stress(0-2) = 0~2번 서버 |
| Test Time | 테스트 실행 시간 | 12d (12일) |

### Loop 제어
```
Loop(1)[1]   // Step 1을 1번 실행
Loop(10)[1]  // Step 1을 10번 반복
```
형식: `Loop(반복횟수)[스텝번호]`

## sat.yaml (K8s Deployment 예시)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stress-sat
  labels:
    app: sat
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sat
  template:
    metadata:
      labels:
        app: sat
    spec:
      containers:
      - name: sat
        image: 10.144.36.119/sdc/stress:1.12
        command: ["/stress/bin/cpum"]
        args: ["-v","10","-o","0","/stress/bin/stressapptest","-s","999999999","--memory_ratio","0.9","--local_numa","-m","64"]
        imagePullPolicy: Always
        securityContext:
          runAsUser: 0
          capabilities:
            add: [SYS_ADMIN]
      volumeMounts:
      - name: cgroup
        hostPath:
          path: /sys/fs/cgroup
          type: Directory
      imagePullSecrets:
      - name: regcred
      nodeSelector:
        owner: cmx
        group: ""
        memorytype: ddr5
        stress: stress
```

### 핵심 포인트
- K8s nodeSelector로 대상 서버 지정 (owner, group, memorytype, stress 라벨)
- 프라이빗 레지스트리 사용 (10.144.36.119)
- stressapptest 실행 (메모리 비율 0.9, 64스레드, NUMA 로컬)
- LABEL의 stress(N) → nodeSelector의 stress 라벨과 연관
