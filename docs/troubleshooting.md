# Troubleshooting 이력

## 2026-04-22 ~ 04-28: 서버 상세 메트릭 차트 표시 안됨

### 증상
- 서버 상세 페이지에서 대부분의 차트가 데이터 없이 빈 카드로 표시
- 일부 차트만 간헐적으로 데이터 표시 (CPU Usage, Disk Usage 등 4-5개만)
- 브라우저 Console에 빨간색 hydration 에러

### 시도한 것들과 결과

| 날짜 | 시도 | 결과 |
|------|------|------|
| 04-22 | PromQL에 `on() group_left()` 조인 사용 | 실패 — 라벨 불일치로 빈 결과 |
| 04-22 | `sum()/sum()` 나누기로 변경 | 부분 성공 — Memory만 개선 |
| 04-22 | 모든 쿼리에 `sum()` 래핑 | 부분 성공 — 일부 차트만 |
| 04-22 | IP 기반 instance 해석 로직 추가 | 실패 — 불필요한 복잡성. 호스트네임 직접 사용이 정답 |
| 04-23 | Prometheus timeout 3초→10초 | 효과 없음 — timeout이 원인이 아니었음 |
| 04-23 | 에러 시 `setData([])` 제거 (데이터 유지) | 효과 없음 |
| 04-23 | ChartSkeleton `Math.random()` 제거 | hydration 에러 해결했지만 차트 문제와 무관 |
| 04-23 | useEffect `series` 의존성 → `seriesKey` 안정화 | 효과 미확인 — 차트 여전히 빈 상태 |
| 04-27 | `id="/"` → `container!=""` 변경 | **PromQL 쿼리는 해결** — check 스크립트에서 데이터 확인됨 |
| 04-28 | 디버그 표시 추가하여 프론트엔드 원인 진단 | pts=363 (121×3), 각 포인트에 시리즈 1개만 → **타임스탬프 불일치 확인** |
| 04-28 | 타임스탬프 정렬 `Math.round(ts/stepSec)*stepSec*1000` | **해결** — 멀티시리즈 차트 정상 표시 |
| 04-28 | 차트 애니메이션 비활성화 + connectNulls | **해결** — 재렌더 시 선 사라짐 방지 |

### 확인된 사실
1. **K8s cAdvisor에서 `id="/"` 는 존재하지 않음** — root cgroup이 없는 환경. `container!=""` 사용해야 함
2. **Prometheus API 응답에 데이터가 있음** (브라우저 Network 탭에서 확인) — 백엔드 문제 아님
3. **프론트엔드 렌더링에서 데이터가 차트로 변환되지 않음** — 원인 조사 중
4. **check 스크립트의 Prometheus URL 혼동** — Grafana(30004)와 Prometheus(ClusterIP 10.100.175.248:8080) 구분 필요

### 근본 원인 (해결됨)
1. **PromQL**: K8s cAdvisor에서 `id="/"`가 존재하지 않음 → `container!=""` 으로 교체
2. **차트 렌더링**: 멀티시리즈 차트에서 각 API 호출의 ms 단위 시간차로 타임스탬프 불일치. 3개 시리즈 × 121개 포인트 = 363개 포인트인데 각 포인트에 시리즈 1개만 존재 → Recharts가 선을 그릴 수 없음. `Math.round(ts / stepSec) * stepSec * 1000`으로 정렬하여 해결

### 교훈
- **Data-First**: 코드 작성 전에 반드시 실제 데이터 확인 (check 스크립트)
- **환경 차이 기록**: K8s cAdvisor의 cgroup 구조는 Docker standalone과 다름
- **URL 혼동 방지**: Grafana/Prometheus/앱 URL을 CLAUDE.md에 명확히 분리 기록
- **한 번에 하나씩**: 전체를 한꺼번에 고치려 하지 말고 메트릭 하나씩 확인
