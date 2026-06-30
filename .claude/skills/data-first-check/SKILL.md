---
name: data-first-check
description: Prometheus 메트릭, BMC/Redfish API, Kubernetes, DB 등 외부 데이터 구조를 확인하는 스크립트를 생성한다. 추측으로 코드 짜기 전에 실제 데이터(라벨·필드명·값 형식)를 먼저 확인하는 CLAUDE.md "Data-First Development Rule"을 자동화. 폐쇄망(air-gapped) 환경이라 화면 출력을 극단적으로 최소화한다. "데이터 확인 스크립트", "Prometheus 라벨 확인", "/data-first-check" 요청 시 사용.
---

# Data-First 확인 스크립트 생성

외부 시스템과 연동하는 코드를 짜기 전에 **실제 데이터 구조를 먼저 확인**한다. 추측으로 코드를 짜지 않는다.

## ⚠️ 실행 환경 제약 (절대 잊지 말 것)

- 사용자 환경은 **사내 폐쇄망(air-gapped)**. 파일 반출·클립보드 복사 불가.
- 사용자는 **화면 출력을 눈으로 보고 손으로 타이핑**해서 결과를 전달한다.
- 따라서 **화면 출력량을 극단적으로 최소화**하는 것이 유일하게 사용자 부담을 줄이는 방법이다.

## 절차

1. **기존 결과 먼저 확인**
   - `check/results/` 에 이미 확인한 데이터가 있는지 Grep/Glob으로 확인. 있으면 재요청하지 말고 그 파일을 참조.

2. **확인 스크립트 작성**
   - 날짜별 파일: `check/targetExecCmd/YYYYMMDD.sh` (오늘 날짜). 같은 날 추가 건은 `YYYYMMDD-N.sh`
   - 서버에서 `bash check/targetExecCmd/YYYYMMDD.sh` 한 줄로 실행 가능해야 함
   - Prometheus는 `http://10.144.38.100:30003` (NodePort, check 스크립트용), DB는 `docker exec firsttest-db-1 psql -U dcim -d dcim`

3. **출력 최소화 원칙 (필수)**
   - 한 줄로 압축 (테이블 목록은 콤마 join)
   - 라벨 구조는 **1개 샘플이면 충분** — 전체 목록 출력 금지
   - 개수/존재 여부만으로 충분하면 상세 데이터 출력 안 함
   - 긴 JSON/YAML은 길이·키 이름만 (`keys: [...], 2847 bytes`)
   - boot_id, machine_id, system_uuid 등 식별값은 생략

4. **사용자에게 실행 요청**
   - 스크립트를 만들고 "서버에서 실행 후 화면 결과를 타이핑해 주세요"라고 안내
   - **명령어를 직접 타이핑하라고 하지 않는다** — 항상 스크립트 파일로 만든다

5. **결과를 파일로 저장**
   - 사용자가 결과를 전달하면 `check/results/YYYYMMDD-항목.md`에 영구 저장. 같은 데이터를 다시 요청하지 않는다.

## Prometheus 쿼리 규칙 (요약)

- `id="/"` 금지 (K8s cAdvisor에 root cgroup 없음), `container!=""` 사용
- node-exporter는 IP:port instance, cAdvisor는 hostname instance
- 세부는 docs/infrastructure.md 참조
