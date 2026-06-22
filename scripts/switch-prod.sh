#!/bin/bash
# 프로덕션 모드 전환 스크립트
# 사용법: sudo bash scripts/switch-prod.sh
set -e

SERVICE_FILE="/etc/systemd/system/dcim.service"

if [ ! -f "$SERVICE_FILE" ]; then
  echo "dcim.service 파일 없음. setup-service.sh --install 먼저 실행 필요"
  exit 1
fi

CURRENT=$(grep 'DCIM_MODE=' "$SERVICE_FILE" | head -1 | grep -o 'DCIM_MODE=[a-z]*' | cut -d= -f2)
echo "현재 모드: ${CURRENT:-미설정}"

sed -i 's/DCIM_MODE=dev/DCIM_MODE=prod/' "$SERVICE_FILE"
systemctl daemon-reload
systemctl restart dcim

echo "프로덕션 모드로 전환 완료"
echo "빌드 진행 중... (1-2분 소요)"
echo "로그 확인: sudo journalctl -u dcim -f"
