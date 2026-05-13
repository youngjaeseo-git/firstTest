#!/bin/bash
# 모델별 데이터 정합성 검증 — 배치 실행
# 사용법: bash check/20260513-verify-batch.sh
#
# 아래 서버 목록을 실제 환경에 맞게 수정 후 실행
# 각 모델별 1대씩, 결과는 check/results/ 폴더에 저장

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERIFY_SCRIPT="${SCRIPT_DIR}/20260513-verify-all-sources.sh"
RESULT_DIR="${SCRIPT_DIR}/results"
mkdir -p "$RESULT_DIR"

# ============================================
# 아래 서버 정보를 실제 값으로 수정해주세요
# 형식: "BMC_IP HOSTNAME HOST_IP MODEL_NAME"
# ============================================
SERVERS=(
  "192.168.10.101 s121x13ae001 10.144.38.101 SPR"
  "192.168.10.102 s131x13ae001 10.144.38.102 GNR-AP"
  "192.168.10.103 s131x13ae002 10.144.38.103 GNR-SP"
  "192.168.10.91  s121ampere01 10.144.38.91  Ampere"
)
# SRF 서버는 현재 부팅 불가로 제외
# 필요시 추가: "BMC_IP HOSTNAME HOST_IP SRF"

echo "================================================================"
echo " 모델별 데이터 정합성 검증 배치"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo " 서버 수: ${#SERVERS[@]}"
echo "================================================================"

for ENTRY in "${SERVERS[@]}"; do
  read -r BMC_IP HOSTNAME HOST_IP MODEL <<< "$ENTRY"
  OUTFILE="${RESULT_DIR}/${MODEL}-${HOSTNAME}.txt"

  echo ""
  echo ">>> [${MODEL}] ${HOSTNAME} (BMC=${BMC_IP}, IP=${HOST_IP})"
  echo "    출력: ${OUTFILE}"

  bash "$VERIFY_SCRIPT" "$BMC_IP" "$HOSTNAME" "$HOST_IP" > "$OUTFILE" 2>&1

  # 결과 요약 한 줄 출력
  if grep -q "PART D" "$OUTFILE"; then
    echo "    완료 (PART D 요약 포함)"
  else
    echo "    WARNING: 일부 데이터 누락 가능"
  fi
done

echo ""
echo "================================================================"
echo " 전체 완료. 결과 파일:"
ls -la "${RESULT_DIR}/"*.txt 2>/dev/null
echo ""
echo " 결과 비교: cat ${RESULT_DIR}/모델명-호스트명.txt"
echo "================================================================"
