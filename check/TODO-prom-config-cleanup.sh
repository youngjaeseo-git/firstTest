#!/bin/bash
# Prometheus ConfigMap과 DB 비교 작업 — 진단 페이지 결과 기반
#
# 할일:
# 1. Prometheus ConfigMap에서 전체 job/target 목록 추출
# 2. 진단 페이지 결과와 대조:
#    - IP-only 타겟: hostname 라벨 추가 필요한 항목 정리
#    - 중복 스크래핑: kubernetes-pods + node-exporter 겹침 → 하나로 통합
#    - Prometheus 고아: Prometheus에 있지만 DB에 없는 장비 → 장비 등록 or 타겟 제거
#    - DB 고아: DB에 있지만 Prometheus에 없는 장비 → Prometheus에 타겟 추가 or DB 정리
# 3. 정리된 목록 기반으로 ConfigMap YAML 생성 or 수정
#
# 참고 파일:
# - check/results/20260601-job-labels.md — job별 타겟 수
# - check/results/20260601-hostname-ip-daemonset.md — hostname-IP 매핑
# - /settings/prometheus-diagnostic 페이지 — 실시간 진단 결과
#
# 상태: 사용자가 회사에서 ConfigMap과 비교 중 (2026-06-02)
echo "이 파일은 TODO 기록용입니다. 실행용 스크립트가 아닙니다."
