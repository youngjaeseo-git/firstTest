#!/bin/bash
# 개발 모드 전환 스크립트 (프로덕션에서 되돌릴 때)
# 사용법: sudo bash scripts/switch-dev.sh
set -e

SERVICE_FILE="/etc/systemd/system/dcim.service"

if [ ! -f "$SERVICE_FILE" ]; then
  echo "dcim.service 파일 없음"
  exit 1
fi

CURRENT=$(grep 'DCIM_MODE=' "$SERVICE_FILE" | head -1 | grep -o 'DCIM_MODE=[a-z]*' | cut -d= -f2)
echo "현재 모드: ${CURRENT:-미설정}"

sed -i 's/DCIM_MODE=prod/DCIM_MODE=dev/' "$SERVICE_FILE"
systemctl daemon-reload
systemctl restart dcim

echo "개발 모드로 전환 완료"
