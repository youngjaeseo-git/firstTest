# Prometheus 장애 요약 및 작업 요청 (다른 모델 전달용)

## 원래 하려던 작업 (장애 해결 후 진행 필요)

### 목표
node-exporter DaemonSet이 각 노드에서 port 9100으로 OS 레벨 메트릭(CPU, Memory, Disk, Network 등)을 이미 수집하고 있다. Prometheus가 이 메트릭을 scrape하도록 ConfigMap에 job을 추가하고 싶다.

### 현재 node-exporter 상태
- DaemonSet `node-exporter`가 namespace `monitoring`에 배포됨
- `hostNetwork: true`, port 9100 사용
- 이미지: `prom/node-exporter:v1.8.1`
- 43개 노드 중 21개 Ready (나머지는 서버룸 이전 등으로 Pending/ImagePullBackOff)
- localhost:9100/metrics 에서 메트릭 응답 확인됨

### 중요: 기존 Prometheus 설정 방식
- 기존 ConfigMap(`prometheus-server-conf`)의 모든 job은 **`static_configs`로 IP:port를 수동 지정**하는 방식
- 예시: `targets: ['10.138.56.65:9200']` 형태로 서버 하나하나 지정
- `kubernetes_sd_configs`는 사용하지 않음 (이전에 이걸로 시도했다가 실패)

### 해야 할 일
1. ConfigMap `prometheus-server-conf`의 `scrape_configs` 섹션에 node-exporter job 추가
2. **반드시 `static_configs` 방식으로** 각 노드의 IP:9100을 타겟으로 지정 (기존 패턴과 동일하게)
3. node-exporter가 Running 상태인 노드들의 IP를 확인하여 타겟 목록 작성
4. ConfigMap 수정 후 Prometheus 파드 재시작하여 반영

### 참고 파일 (서버 내)
- ConfigMap 원본: `/root/dany/prometheus-config-map_ver5.yaml`
- 설치 스크립트: `/root/dany/install_prometheus.sh`
- node-exporter DaemonSet: 이미 배포됨 (`kubectl -n monitoring get daemonset node-exporter`로 확인)

### 주의사항
- ServiceAccount는 `default`를 유지할 것 (변경하면 기존 타겟이 깨짐 - 아래 장애 참조)
- `kubernetes_sd_configs` 사용 금지 (기존 설정과 호환 안 됨, 이전 시도에서 실패)
- ConfigMap 수정 시 기존 job들(kubernetes-cadvisor, kubernetes-nodes, QRA-SMC-DDR5-Dell 등)은 절대 건드리지 말 것

---

## 장애 경과 (해결됨 - 참고용)

## 환경
- K8s master: 10.144.38.100
- Prometheus Deployment: `prometheus-deployment` (namespace: monitoring)
- ClusterIP: http://10.100.175.248:8080 / NodePort: 10.144.38.100:30003
- ConfigMap: `prometheus-server-conf`
- 원본 파일: `/root/dany/prometheus-config-map_ver5.yaml`
- 설치 스크립트: `/root/dany/install_prometheus.sh`
- 기존 scrape: `static_configs`로 IP:port 수동 지정 방식

## 변경 전 정상 상태
- SA: `default`, cadvisor 등 305 타겟 정상 수집

## 시간순 변경

1. **node-exporter job 추가** → ConfigMap에 `kubernetes_sd_configs: role: node` 추가 → 타겟 0
2. **SA `prometheus` 생성 및 패치** → node-exporter 여전히 0, **cadvisor도 0으로 떨어짐**
3. **SA `default`로 롤백 패치** → 새 파드 CrashLoopBackOff, 기존 파드 Running (2개 공존)
4. **Deployment 삭제 후 원본 스크립트 재설치** → 파드 Running이지만 **타겟 여전히 0**

## 현재 상태 (해결됨)
- Prometheus 복구 완료, 기존 타겟 정상 수집 중
- 남은 작업: node-exporter scrape job 추가 (위 "원래 하려던 작업" 참조)

## 확인 필요
1. Prometheus가 로드한 config에 job이 있는지
2. Prometheus 로그 에러
3. ClusterRoleBinding 바인딩 대상
4. Deployment의 serviceAccountName
5. ConfigMap이 원본과 다른지

## 확인 명령어

### A. Prometheus가 로드한 설정 확인
```bash
PROM=http://10.100.175.248:8080
curl -s $PROM/api/v1/status/config | python3 -c "
import sys,json
d=json.load(sys.stdin)
config=d.get('data',{}).get('yaml','')
jobs=[line.strip() for line in config.split('\n') if 'job_name' in line]
print('Loaded jobs: ' + str(len(jobs)))
for j in jobs: print('  ' + j)
"
```

### B. Prometheus 로그
```bash
kubectl -n monitoring logs deployment/prometheus-deployment --tail=30
```

### C. ClusterRoleBinding 확인
```bash
kubectl get clusterrolebinding prometheus -o yaml | grep -A5 subjects
```

### D. Deployment SA 확인
```bash
kubectl -n monitoring get deployment prometheus-deployment -o jsonpath='{.spec.template.spec.serviceAccountName}'
```

### E. 타겟 확인
```bash
PROM=http://10.100.175.248:8080
curl -s $PROM/api/v1/targets | python3 -c "
import sys,json
d=json.load(sys.stdin)
targets=d.get('data',{}).get('activeTargets',[])
by_job={}
for t in targets:
    j=t['labels'].get('job','unknown')
    s=t.get('health','unknown')
    by_job.setdefault(j,[0,0])
    if s=='up': by_job[j][0]+=1
    else: by_job[j][1]+=1
for j,v in sorted(by_job.items()):
    print(j + ': up=' + str(v[0]) + ', down=' + str(v[1]))
print('Total active targets: ' + str(len(targets)))
"
```
