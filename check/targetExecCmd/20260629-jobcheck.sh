#!/bin/bash
# Lab-3 node_filesystem 의 job 라벨이 앱 매처(job=node-exporter)와 맞는지 확인
# 실행: Prometheus(10.100.175.248:8080) 도달 가능한 곳 (Lab-1 컨텍스트/DCIM 앱 서버)
# 실행: bash check/targetExecCmd/20260629-jobcheck.sh
PROM="http://10.100.175.248:8080"
I="10.144.131.115"   # Lab-3 정상 노드 1대
echo "=== L3_FS_JOB ==="
# 1) 이 인스턴스 fs 메트릭에 붙은 job 라벨 종류
echo "JOBS=$(curl -s --max-time 5 "$PROM/api/v1/query?query=node_filesystem_size_bytes%7Binstance%3D~%22$I.*%22%7D" 2>/dev/null | grep -oE '"job":"[^"]*"' | sort -u | tr '\n' ' ')"
# 2) 앱이 실제로 쓰는 매처(job=node-exporter)로 매칭되는 개수 (>0 이면 화면에 뜸)
echo "APP_MATCH_CNT=$(curl -s --max-time 5 "$PROM/api/v1/query?query=count(node_filesystem_size_bytes%7Binstance%3D~%22$I.*%22%2Cjob%3D%22node-exporter%22%7D)" 2>/dev/null | grep -oE '"value":\[[0-9.]+,"[0-9]+"\]')"
echo "=== END ==="
