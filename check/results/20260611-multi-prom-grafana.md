# Multi-Prometheus 및 Grafana 데이터소스 확인 결과 (2026-06-11)

## 스크립트 1 결과 (20260611.sh)

### Lab-3 Prometheus 직접 접근 (from 38.100)
- Lab3 NodePort (131.100:30003): TIMEOUT
- Lab3 ClusterIP (10.97.9.194:8080): TIMEOUT

### Lab-1 Prometheus에서 Lab-3 메트릭
- Lab3 node-exporter (131.x): err (0건)
- Lab3 PCM (hostname): 0건

### 로컬 DB 서비스 (38.100)
- 0.0.0.0:5432 (K8s PostgreSQL)
- firsttest-db-1: postgres:16-alpine, 0.0.0.0:5433->5432/tcp (DCIM 앱 DB)

### Docker 컨테이너 (38.100, 주요 항목)
- prometheus (image: 10.144.36.119/monitoring/prom/prometheus)
- node-exporter
- grafana
- ipmi-exporter
- firsttest-db-1 (DCIM 앱)

## 스크립트 2 결과 (20260611-2.sh)

### Grafana 데이터소스 목록
| 이름 | 타입 | URL | 비고 |
|------|------|-----|------|
| CSV-1 | csv | /var/lib/grafana | |
| CSV-2 | csv | http://10.144.38.100:9150 | |
| dc_eval_db | postgres | 10.144.36.119:5432 | DC 평가 DB? |
| ddr4_temp | csv | /var/log/ddr4_temp_log/p1_dimma-d.csv | DDR4 온도 CSV! |
| InfluxDB | influxdb | http://10.144.38.100:8086/ | |
| PostgreSQL | postgres | 10.144.38.151:5432 | |
| PostgreSQL-Analysis | postgres | 10.144.131.214:5432 | Lab-3 분석 DB |
| PostgreSQL-gehyuk | postgres | 10.144.36.96:5432 | |
| PostgreSQL-hy | postgres | 10.144.38.151:5432 | |
| PostgreSQL-shmoo | postgres | 10.144.38.151:5432 | |
| prometheus | prometheus | http://prometheus-service.monitoring.svc:8080 | Cluster 1 |
| prometheus-1 | prometheus | http://prometheus-service.monitoring.svc:8080 | Cluster 1 |
| prometheus-2 | prometheus | http://prometheus-service.monitoring.svc:8080 | Cluster 1 |
| **prometheus-3rd** | **prometheus** | **http://10.144.131.190:30003** | **Cluster 2!** |

### Cluster 2 Prometheus (10.144.131.190:30003)
- 접근: 38.100에서 HTTP 200 성공 (포트 30003만 가능)
- 타겟: total=47, up=3, down=44
  - kube-state-metrics: up=1
  - kubernetes-apiservers: up=1
  - kubernetes-cadvisor: up=0, down=21
  - kubernetes-nodes: up=0, down=21
  - kubernetes-service-endpoints: up=1, down=2
  - **node-exporter job 없음!**

### DCIM 서버(38.100) → Lab-3 접근 결과
- 10.97.9.194:8080 (ClusterIP): TIMEOUT
- 131.100:30003 (NodePort): TIMEOUT
- 131.190:8080: TIMEOUT
- **131.190:30003: HTTP 200 성공!** (스크립트 섹션 2에서 확인)

## 핵심 결론

1. **Lab-3 Prometheus URL 확정**: `http://10.144.131.190:30003`
2. **DCIM(38.100)에서 접근 가능**: 포트 30003만 열려 있음
3. **Lab-3 Prometheus 상태 불량**: 47개 타겟 중 3개만 up, node-exporter 없음
4. **온도 데이터**: `ddr4_temp` CSV 데이터소스 존재 (DDR4 DIMM 온도)
5. **다수 PostgreSQL DB 존재**: dc_eval_db, PostgreSQL-Analysis 등
