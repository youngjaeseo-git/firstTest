#!/bin/bash
# recovery.sh — DCIM 장애 복구 통합 스크립트
# 사용법: ./scripts/recovery.sh

cd "$(dirname "$0")/.."

export PATH=$HOME/opt/node-20/bin:$PATH

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PORT=${DCIM_PORT:-3000}

print_header() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  DCIM 장애 복구 도구${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
}

print_status() {
  echo -e "${CYAN}--- 현재 시스템 상태 ---${NC}"
  echo ""

  # Docker
  if docker info > /dev/null 2>&1; then
    echo -e "  Docker:       ${GREEN}실행 중${NC}"
  else
    echo -e "  Docker:       ${RED}중지됨${NC}"
  fi

  # DB 컨테이너
  if docker compose ps db 2>/dev/null | grep -q "healthy"; then
    echo -e "  DB 컨테이너:  ${GREEN}정상 (healthy)${NC}"
  elif docker compose ps db 2>/dev/null | grep -q "Up"; then
    echo -e "  DB 컨테이너:  ${YELLOW}실행 중 (unhealthy)${NC}"
  else
    echo -e "  DB 컨테이너:  ${RED}중지됨${NC}"
  fi

  # DB 연결 테스트
  local db_container
  db_container=$(docker compose ps -q db 2>/dev/null)
  if [ -n "$db_container" ]; then
    if docker exec "$db_container" pg_isready -U dcim -d dcim > /dev/null 2>&1; then
      local table_count
      table_count=$(docker exec "$db_container" psql -U dcim -d dcim -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")
      echo -e "  DB 연결:      ${GREEN}정상 (테이블 ${table_count}개)${NC}"
    else
      echo -e "  DB 연결:      ${RED}실패${NC}"
    fi
  fi

  # 앱 프로세스
  local app_pid
  app_pid=$(pgrep -f "next dev" 2>/dev/null | head -1)
  if [ -n "$app_pid" ]; then
    echo -e "  앱 서버:      ${GREEN}실행 중 (PID: $app_pid, 포트: $PORT)${NC}"
  else
    echo -e "  앱 서버:      ${RED}중지됨${NC}"
  fi

  # Prometheus 연결
  local prom_url="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
  if curl -s --connect-timeout 3 "$prom_url/-/healthy" > /dev/null 2>&1; then
    echo -e "  Prometheus:   ${GREEN}연결 가능${NC}"
  else
    echo -e "  Prometheus:   ${YELLOW}연결 불가 (내부망 전용일 수 있음)${NC}"
  fi

  # 로그 크기
  if [ -f /tmp/dcim-app.log ]; then
    local log_size
    log_size=$(du -h /tmp/dcim-app.log | cut -f1)
    echo -e "  앱 로그:      $log_size (/tmp/dcim-app.log)"
  fi

  # 백업 상태
  local backup_count
  backup_count=$(find "$HOME/dcim-backups" -name "dcim-*.sql.gz" -type f 2>/dev/null | wc -l)
  if [ "$backup_count" -gt 0 ]; then
    local latest
    latest=$(ls -t "$HOME/dcim-backups"/dcim-*.sql.gz 2>/dev/null | head -1)
    local latest_date
    latest_date=$(stat -c %y "$latest" 2>/dev/null | cut -d. -f1)
    echo -e "  DB 백업:      ${GREEN}${backup_count}개 (최근: $latest_date)${NC}"
  else
    echo -e "  DB 백업:      ${YELLOW}없음${NC}"
  fi

  echo ""
}

restart_app() {
  echo -e "${CYAN}[앱 재시작]${NC}"

  pkill -f "next dev" 2>/dev/null && echo "  기존 프로세스 종료됨" || echo "  실행 중인 서버 없음"
  sleep 1

  # DB 연결 정보 구성
  local db_container
  db_container=$(docker compose ps -q db 2>/dev/null)
  if [ -z "$db_container" ]; then
    echo -e "${RED}  DB 컨테이너가 없습니다. 먼저 DB를 시작하세요.${NC}"
    return 1
  fi

  local pw
  pw=$(docker inspect "$db_container" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
  pw="${pw:-${DB_PASSWORD:-dcim_password}}"
  local db_port
  db_port=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
  db_port="${db_port:-${DB_PORT:-5432}}"
  export DATABASE_URL="postgresql://dcim:${pw}@localhost:${db_port}/dcim?schema=public"

  nohup npm run dev -- -p "$PORT" > /tmp/dcim-app.log 2>&1 &
  echo -e "${GREEN}  서버 시작됨 (PID: $!, 포트: $PORT)${NC}"
  echo "  로그: tail -f /tmp/dcim-app.log"
}

restart_db() {
  echo -e "${CYAN}[DB 컨테이너 재시작]${NC}"

  docker compose restart db 2>/dev/null
  echo "  DB 재시작 요청됨. 준비 대기 중..."

  for i in $(seq 1 30); do
    if docker compose ps db 2>/dev/null | grep -q "healthy"; then
      echo -e "${GREEN}  DB 준비 완료${NC}"
      return 0
    fi
    sleep 1
  done

  echo -e "${RED}  DB가 30초 안에 준비되지 않았습니다.${NC}"
  docker compose logs db --tail=10
  return 1
}

restart_all() {
  echo -e "${CYAN}[전체 재시작: DB + 앱]${NC}"
  echo ""

  # 앱 종료
  pkill -f "next dev" 2>/dev/null && echo "  앱 종료됨" || true
  sleep 1

  # DB 재시작
  restart_db || return 1
  echo ""

  # 마이그레이션
  local db_container
  db_container=$(docker compose ps -q db 2>/dev/null)
  local pw
  pw=$(docker inspect "$db_container" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
  pw="${pw:-${DB_PASSWORD:-dcim_password}}"
  local db_port
  db_port=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
  db_port="${db_port:-${DB_PORT:-5432}}"
  export DATABASE_URL="postgresql://dcim:${pw}@localhost:${db_port}/dcim?schema=public"

  echo "  마이그레이션 실행 중..."
  npx prisma migrate deploy 2>&1 | tail -3
  npx prisma generate 2>&1 | tail -1
  echo ""

  # 앱 시작
  restart_app
}

restore_from_backup() {
  echo -e "${CYAN}[백업에서 DB 복원]${NC}"
  echo ""

  if [ -f "$(dirname "$0")/backup-db.sh" ]; then
    bash "$(dirname "$0")/backup-db.sh" --list
    echo ""
    bash "$(dirname "$0")/backup-db.sh" --restore
  else
    echo -e "${RED}  backup-db.sh를 찾을 수 없습니다.${NC}"
  fi
}

check_recent_errors() {
  echo -e "${CYAN}[최근 에러 로그]${NC}"
  echo ""

  if [ ! -f /tmp/dcim-app.log ]; then
    echo "  로그 파일이 없습니다."
    return
  fi

  local error_count
  error_count=$(grep -ci "error\|ERR\|ECONNREFUSED\|FATAL\|unhandled" /tmp/dcim-app.log 2>/dev/null | tail -1)
  echo "  총 에러 수: $error_count"
  echo ""

  echo "  --- 최근 에러 (마지막 20줄) ---"
  grep -i "error\|ERR\|ECONNREFUSED\|FATAL\|unhandled" /tmp/dcim-app.log 2>/dev/null | tail -20 || echo "  에러 없음"
  echo ""
}

show_menu() {
  echo "작업을 선택하세요:"
  echo ""
  echo -e "  ${CYAN}1${NC}) 앱 서버만 재시작"
  echo -e "  ${CYAN}2${NC}) DB 컨테이너 재시작"
  echo -e "  ${CYAN}3${NC}) 전체 재시작 (DB + 마이그레이션 + 앱)"
  echo -e "  ${CYAN}4${NC}) 백업에서 DB 복원"
  echo -e "  ${CYAN}5${NC}) 최근 에러 로그 확인"
  echo -e "  ${CYAN}6${NC}) 시스템 상태 다시 확인"
  echo -e "  ${CYAN}0${NC}) 종료"
  echo ""
}

# --- 메인 ---
print_header
print_status

while true; do
  show_menu
  read -r -p "선택 [0-6]: " choice
  echo ""

  case "$choice" in
    1) restart_app ;;
    2) restart_db ;;
    3) restart_all ;;
    4) restore_from_backup ;;
    5) check_recent_errors ;;
    6) print_status ;;
    0) echo "종료"; exit 0 ;;
    *) echo -e "${YELLOW}잘못된 선택입니다.${NC}" ;;
  esac

  echo ""
  read -r -p "Enter를 누르면 메뉴로 돌아갑니다..." _
  echo ""
done
