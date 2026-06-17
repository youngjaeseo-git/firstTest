#!/bin/bash
# DCIM systemd 서비스 설치/관리
# 사용법:
#   ./scripts/setup-service.sh --install     서비스 등록 + 시작
#   ./scripts/setup-service.sh --uninstall   서비스 중지 + 제거
#   ./scripts/setup-service.sh --status      서비스 상태 확인
#   ./scripts/setup-service.sh --restart     서비스 재시작 (코드 변경 후)
#   ./scripts/setup-service.sh --logs        실시간 로그 보기

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="dcim"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
RUN_USER=$(whoami)

generate_service_file() {
  cat <<EOF
[Unit]
Description=DCIM Management System (DC Express)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/scripts/service-start.sh
Environment=PATH=${HOME}/opt/node-20/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=DCIM_MODE=dev
Environment=DCIM_PORT=3000
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dcim

[Install]
WantedBy=multi-user.target
EOF
}

case "${1:-}" in
  --install)
    echo "=== DCIM 서비스 설치 ==="
    echo "  APP_DIR: ${APP_DIR}"
    echo "  User:    ${RUN_USER}"
    echo ""

    chmod +x "${APP_DIR}/scripts/service-start.sh"

    echo "1. 서비스 파일 생성: ${SERVICE_FILE}"
    generate_service_file | sudo tee "$SERVICE_FILE" > /dev/null

    echo "2. systemd 리로드"
    sudo systemctl daemon-reload

    echo "3. 서비스 활성화 (부팅 시 자동 시작)"
    sudo systemctl enable "$SERVICE_NAME"

    echo "4. 서비스 시작"
    sudo systemctl start "$SERVICE_NAME"

    echo ""
    echo "=== 설치 완료 ==="
    echo ""
    echo "  상태 확인:  systemctl status dcim"
    echo "  로그 보기:  journalctl -u dcim -f"
    echo "  재시작:     systemctl restart dcim"
    echo "  중지:       systemctl stop dcim"
    echo ""
    echo "  코드 수정 후:  git pull && systemctl restart dcim"
    echo "  프로덕션 전환: ${SERVICE_FILE} 에서 DCIM_MODE=prod 로 변경 후 restart"
    echo ""

    sleep 2
    systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null || true
    ;;

  --uninstall)
    echo "=== DCIM 서비스 제거 ==="
    sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    sudo rm -f "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "서비스 제거 완료"
    ;;

  --status)
    systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null || echo "서비스가 등록되지 않았습니다."
    ;;

  --restart)
    echo "DCIM 서비스 재시작..."
    sudo systemctl restart "$SERVICE_NAME"
    sleep 2
    systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null || true
    ;;

  --logs)
    journalctl -u "$SERVICE_NAME" -f --no-pager
    ;;

  *)
    echo "사용법: $0 {--install|--uninstall|--status|--restart|--logs}"
    exit 1
    ;;
esac
