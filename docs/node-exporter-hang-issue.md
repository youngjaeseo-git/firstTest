# node-exporter 응답 불가 이슈 (GNR-AP / GNR-SP) — 해결됨

## 해결
- **원인**: calico 파드가 stale 상태로 네트워크 통신 차단
- **해결 방법**: 
  1. 각 워커노드의 iptables/firewalld 9100 포트 재확인 (이미 허용 상태였음)
  2. 각 워커노드의 calico 파드를 kubectl delete로 재시작
  3. **즉시 반영되지 않음** — 재시작 후 약 30분 이상 지연 발생
- **주의사항**:
  - calico 파드 재시작 직후에는 node-exporter 호출이 여전히 실패함
  - 10분 이내 확인 시 안 되는 것처럼 보이나, 30분 정도 기다리면 정상화됨
  - calico가 네트워크 정책/라우팅을 재구성하는 데 시간이 필요한 것으로 추정
- **결과**: SPR / GNR-AP / GNR-SP 3대 모두 node-exporter 정상 응답 (Ampere 제외)
- **날짜**: 2026-05-14

---

## 환경
- K8s master: 10.144.38.100
- Prometheus: http://10.100.175.248:8080 (ClusterIP)
- node-exporter DaemonSet: namespace monitoring, hostNetwork:true, port 9100
- image: prom/node-exporter:v1.8.1

## 정상 서버 (비교 기준)
- **SPR** s121x13ae003 (10.144.38.103)
  - Host ping OK, node-exporter OK (HTTP 200, 448ms, 392KB)
  - Prometheus scrape: 정상 (up)

## 문제 서버
### GNR-AP s222hax14ae011 (10.144.38.61)
- Host ping: OK (서버 켜져있음)
- BMC: OK (PowerState=On)
- K8s node: Ready
- kubernetes-cadvisor: UP (cAdvisor 정상)
- node-exporter 파드: **Running** (kubectl 기준)
- node-exporter 로그: `write tcp 10.144.38.61:9100 -> 10.144.38.100:33981: write: broken pipe`
- 마스터에서 curl http://10.144.38.61:9100/metrics → **HTTP 000 (30초 타임아웃)**
- **서버 자체에서 curl http://localhost:9100/metrics → 응답 없음 (멈춤)**

### GNR-SP s222hx14ae021 (10.144.38.81)
- Host ping: OK
- BMC: OK (PowerState=On)
- K8s node: Ready
- kubernetes-cadvisor: UP
- node-exporter 파드: **Running**
- node-exporter 로그: `Listening on address=[::]:9100` / `TLS is disabled, http2=false`
- 마스터에서 curl http://10.144.38.81:9100/metrics → **HTTP 000 (11ms 즉시 거절)**
- **서버 자체에서 curl http://localhost:9100/metrics → 응답 없음 (멈춤)**

## 확인한 것
1. hostNetwork: true 설정 확인됨
2. iptables: 9100 포트 허용 상태
3. firewalld: running 상태, 9100/tcp ALREADY_ENABLED (이미 허용됨)
4. 파드 Running이고 로그에 Listening 표시되나, 실제 HTTP 응답 불가
5. localhost에서도 응답 안 됨 → 네트워크/방화벽 문제가 아님

## 추정 원인
- node-exporter 프로세스가 내부적으로 hang 상태
- 가능성: stuck 파일시스템 마운트 (NFS 등)로 filesystem collector가 블로킹
- 가능성: 특정 collector가 /host (hostPath /) 마운트에서 응답 대기 중

## 아직 시도 안 한 것
1. node-exporter 파드 삭제 후 재시작 (kubectl delete pod)
2. 재시작 후에도 멈추면 collector 제외 옵션 필요:
   - `--no-collector.filesystem`
   - 또는 `--collector.filesystem.mount-points-exclude` 옵션 조정
3. 해당 서버에서 `mount` 명령으로 stuck 마운트 확인
4. `strace` 또는 `cat /proc/PID/stack`으로 node-exporter 프로세스가 어디서 멈췄는지 확인

## DaemonSet 설정 (현재)
```yaml
containers:
  - name: node-exporter
    image: prom/node-exporter:v1.8.1
    args:
      - "--path.rootfs=/host"
      - "--path.procfs=/host/proc"
      - "--path.sysfs=/host/sys"
      - "--collector.filesystem.mount-points-exclude=^/(dev|proc|sys|var/lib/docker/.+|var/lib/kubelet/.+)($|/)"
    ports:
      - containerPort: 9100
        hostPort: 9100
    volumeMounts:
      - name: rootfs
        mountPath: /host
        readOnly: true
        mountPropagation: HostToContainer
```

## Prometheus scrape 설정
```yaml
- job_name: node-exporter
  scrape_interval: 5s
  scrape_timeout: 5s
  static_configs:
    - targets:
      - 10.144.38.61:9100
      - 10.144.38.81:9100
      - 10.144.38.103:9100
      # ... (총 19개 타겟)
```
