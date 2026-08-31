#!/bin/bash
# setup-logrotate.sh — DCIM 앱 로그 로테이션 설정
# 사용법:
#   ./scripts/setup-logrotate.sh            logrotate 설정 + cron 등록
#   ./scripts/setup-logrotate.sh --status   현재 로그 상태 확인
#   ./scripts/setup-logrotate.sh --rotate   즉시 로테이션 실행

set -euo pipefail

cd "$(dirname "$0")/.."

LOG_FILE="/tmp/dcim-app.log"
LOG_DIR="$HOME/dcim-logs"
LOGROTATE_CONF="$HOME/.dcim-logrotate.conf"
CRON_MARKER="# DCIM-LOGROTATE"

mkdir -p "$LOG_DIR"

do_setup() {
  # logrotate 설정 파일 생성
  cat > "$LOGROTATE_CONF" << EOF
$LOG_FILE {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    size 50M
    copytruncate
    olddir $LOG_DIR
    dateext
    dateformat -%Y%m%d
}
EOF

  echo "=== DCIM 로그 로테이션 설정 ==="
  echo "설정 파일: $LOGROTATE_CONF"
  echo "로그 원본: $LOG_FILE"
  echo "보관 위치: $LOG_DIR"
  echo "보관 기간: 7일"
  echo "로테이션: 매일 또는 50MB 초과 시"
  echo ""

  # cron 등록
  local existing
  existing=$(crontab -l 2>/dev/null || true)

  if echo "$existing" | grep -q "$CRON_MARKER"; then
    echo "cron 이미 등록됨"
  else
    (echo "$existing"; echo "0 4 * * * /usr/sbin/logrotate -s $HOME/.dcim-logrotate.state $LOGROTATE_CONF $CRON_MARKER") | crontab -
    echo "cron 등록 완료: 매일 04:00 로그 로테이션"
  fi

  echo ""
  echo "즉시 로테이션 테스트: ./scripts/setup-logrotate.sh --rotate"
}

do_status() {
  echo "=== DCIM 로그 상태 ==="
  echo ""

  if [ -f "$LOG_FILE" ]; then
    local size
    size=$(du -h "$LOG_FILE" | cut -f1)
    local lines
    lines=$(wc -l < "$LOG_FILE")
    echo "현재 로그: $LOG_FILE ($size, ${lines}줄)"
  else
    echo "현재 로그: $LOG_FILE (없음)"
  fi

  echo ""
  echo "보관된 로그:"
  if ls "$LOG_DIR"/dcim-app.log-* 1>/dev/null 2>&1; then
    ls -lhtr "$LOG_DIR"/dcim-app.log-* | awk '{printf "  %s %s  %s (%s)\n", $6, $7, $NF, $5}'
  else
    echo "  (없음)"
  fi

  echo ""
  local cron_entry
  cron_entry=$(crontab -l 2>/dev/null | grep "$CRON_MARKER" || true)
  if [ -n "$cron_entry" ]; then
    echo "cron: 등록됨"
  else
    echo "cron: 미등록 (./scripts/setup-logrotate.sh 실행 필요)"
  fi
}

do_rotate() {
  if [ ! -f "$LOGROTATE_CONF" ]; then
    echo "설정이 없습니다. 먼저 ./scripts/setup-logrotate.sh 를 실행하세요."
    exit 1
  fi

  echo "로그 로테이션 실행 중..."
  /usr/sbin/logrotate -f -s "$HOME/.dcim-logrotate.state" "$LOGROTATE_CONF" 2>&1
  echo "완료"
  do_status
}

case "${1:-}" in
  --status)
    do_status
    ;;
  --rotate)
    do_rotate
    ;;
  *)
    do_setup
    ;;
esac
