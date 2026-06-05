#!/bin/bash
# backup-db.sh — PostgreSQL DB 백업 (Docker 컨테이너 기반)
# 사용법:
#   ./scripts/backup-db.sh              수동 백업 실행
#   ./scripts/backup-db.sh --install    cron 자동 백업 등록 (매일 03:00)
#   ./scripts/backup-db.sh --uninstall  cron 등록 해제
#   ./scripts/backup-db.sh --list       백업 목록 확인
#   ./scripts/backup-db.sh --restore    최근 백업에서 복원 (확인 후)

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="$HOME/dcim-backups"
KEEP_DAYS=7
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dcim-${TIMESTAMP}.sql.gz"
CRON_MARKER="# DCIM-DB-BACKUP"
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/backup-db.sh"

mkdir -p "$BACKUP_DIR"

get_db_container() {
  docker compose ps -q db 2>/dev/null
}

get_db_password() {
  local container
  container=$(get_db_container)
  if [ -z "$container" ]; then
    echo "${DB_PASSWORD:-dcim_password}"
    return
  fi
  local pw
  pw=$(docker inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
  echo "${pw:-${DB_PASSWORD:-dcim_password}}"
}

do_backup() {
  local container
  container=$(get_db_container)
  if [ -z "$container" ]; then
    echo "DB 컨테이너가 실행 중이 아닙니다."
    exit 1
  fi

  echo "=== DCIM DB 백업 ==="
  echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"

  docker exec "$container" pg_dump -U dcim -d dcim --clean --if-exists 2>/dev/null | gzip > "$BACKUP_FILE"

  local size
  size=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "백업 완료: $BACKUP_FILE ($size)"

  # 오래된 백업 삭제
  local deleted=0
  while IFS= read -r old_file; do
    rm -f "$old_file"
    deleted=$((deleted + 1))
  done < <(find "$BACKUP_DIR" -name "dcim-*.sql.gz" -mtime +${KEEP_DAYS} -type f 2>/dev/null)

  if [ "$deleted" -gt 0 ]; then
    echo "${KEEP_DAYS}일 초과 백업 ${deleted}개 삭제"
  fi

  echo "보관 중: $(find "$BACKUP_DIR" -name "dcim-*.sql.gz" -type f | wc -l)개"
}

do_list() {
  echo "=== DCIM DB 백업 목록 ==="
  echo "위치: $BACKUP_DIR"
  echo ""
  if ! ls "$BACKUP_DIR"/dcim-*.sql.gz 1>/dev/null 2>&1; then
    echo "백업 파일이 없습니다."
    return
  fi
  ls -lhtr "$BACKUP_DIR"/dcim-*.sql.gz | awk '{printf "  %s %s  %s\n", $6, $7, $NF}'
  echo ""
  echo "총 $(find "$BACKUP_DIR" -name "dcim-*.sql.gz" -type f | wc -l)개"
}

do_restore() {
  local target="$1"

  if [ -z "$target" ]; then
    target=$(ls -t "$BACKUP_DIR"/dcim-*.sql.gz 2>/dev/null | head -1)
  fi

  if [ -z "$target" ] || [ ! -f "$target" ]; then
    echo "복원할 백업 파일이 없습니다."
    exit 1
  fi

  local container
  container=$(get_db_container)
  if [ -z "$container" ]; then
    echo "DB 컨테이너가 실행 중이 아닙니다."
    exit 1
  fi

  echo "=== DCIM DB 복원 ==="
  echo "파일: $target"
  echo ""
  echo "*** 주의: 현재 DB가 완전히 덮어씌워집니다 ***"
  read -r -p "계속하시겠습니까? (yes 입력): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "취소됨"
    exit 0
  fi

  # 복원 전 현재 상태 백업
  echo "복원 전 현재 DB 백업 중..."
  local pre_restore="$BACKUP_DIR/dcim-pre-restore-${TIMESTAMP}.sql.gz"
  docker exec "$container" pg_dump -U dcim -d dcim --clean --if-exists 2>/dev/null | gzip > "$pre_restore"
  echo "  현재 상태 저장: $pre_restore"

  echo "복원 중..."
  gunzip -c "$target" | docker exec -i "$container" psql -U dcim -d dcim --quiet 2>/dev/null
  echo "복원 완료"
}

do_install_cron() {
  local existing
  existing=$(crontab -l 2>/dev/null || true)

  if echo "$existing" | grep -q "$CRON_MARKER"; then
    echo "이미 cron에 등록되어 있습니다."
    echo "$existing" | grep "$CRON_MARKER"
    return
  fi

  (echo "$existing"; echo "0 3 * * * cd $(pwd) && $SCRIPT_PATH >> $BACKUP_DIR/backup.log 2>&1 $CRON_MARKER") | crontab -
  echo "cron 등록 완료: 매일 03:00 자동 백업"
  echo "로그: $BACKUP_DIR/backup.log"
}

do_uninstall_cron() {
  local existing
  existing=$(crontab -l 2>/dev/null || true)

  if ! echo "$existing" | grep -q "$CRON_MARKER"; then
    echo "등록된 cron이 없습니다."
    return
  fi

  echo "$existing" | grep -v "$CRON_MARKER" | crontab -
  echo "cron 등록 해제 완료"
}

case "${1:-}" in
  --install)
    do_install_cron
    ;;
  --uninstall)
    do_uninstall_cron
    ;;
  --list)
    do_list
    ;;
  --restore)
    do_restore "${2:-}"
    ;;
  *)
    do_backup
    ;;
esac
