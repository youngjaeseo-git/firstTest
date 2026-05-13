# Prometheus 장애 요약 (다른 모델 전달용)

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

## 현재 상태
- 파드 Running, 타겟 0, DCIM에서 Prometheus 데이터 안 보임
- SA 조회 시 빈 값

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
