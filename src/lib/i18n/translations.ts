/**
 * Translation strings for Korean/English.
 *
 * Keys use dot notation (e.g. "nav.dashboard"). Missing keys fall back
 * to the key itself so untranslated strings are visible but not fatal.
 */

export type Language = "en" | "ko";

export const LANGUAGES: Language[] = ["en", "ko"];

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.servers": "Servers",
    "nav.infrastructure": "Infrastructure",
    "nav.racks": "Racks",
    "nav.alerts": "Alerts",
    "nav.capacity": "Capacity",
    "nav.reports": "Reports",
    "nav.settings": "Settings",

    // Header
    "header.searchPlaceholder": "Search servers, racks, alerts...",
    "header.alerts": "Alerts",
    "header.alerts.firing": "firing",
    "header.alerts.none": "No active alerts",
    "header.alerts.viewAll": "View all alerts",
    "header.logout": "Logout",

    // Dashboard metrics
    "dashboard.avgCpu": "Avg CPU Usage",
    "dashboard.avgMemory": "Avg Memory",
    "dashboard.avgTemperature": "Avg Temperature",
    "dashboard.totalPower": "Total Power",
    "dashboard.avgTemperature.sub": "All servers avg",
    "dashboard.totalPower.sub": "All servers total",
    "dashboard.nodes": "Prometheus Nodes",
    "dashboard.nodes.up": "up",
    "dashboard.nodes.down": "nodes down",
    "dashboard.nodes.healthy": "All nodes healthy",
    "dashboard.avgUptime": "Avg Uptime",
    "dashboard.avgUptime.sub": "Average server uptime",
    "dashboard.avgUptime.days": "days",
    "dashboard.networkIn": "Network Inbound",
    "dashboard.networkIn.tx": "TX",
    "dashboard.prometheus.unavailable": "Prometheus Unavailable",
    "dashboard.prometheus.cannotFetch": "Cannot fetch live metrics",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.loading": "Loading...",
    "common.language": "Language",
  },
  ko: {
    // Navigation
    "nav.dashboard": "대시보드",
    "nav.servers": "서버",
    "nav.infrastructure": "인프라",
    "nav.racks": "랙",
    "nav.alerts": "알림",
    "nav.capacity": "용량 관리",
    "nav.reports": "리포트",
    "nav.settings": "설정",

    // Header
    "header.searchPlaceholder": "서버, 랙, 알림 검색...",
    "header.alerts": "알림",
    "header.alerts.firing": "발생 중",
    "header.alerts.none": "활성 알림 없음",
    "header.alerts.viewAll": "모든 알림 보기",
    "header.logout": "로그아웃",

    // Dashboard metrics
    "dashboard.avgCpu": "평균 CPU 사용률",
    "dashboard.avgMemory": "평균 메모리",
    "dashboard.avgTemperature": "평균 온도",
    "dashboard.totalPower": "총 전력",
    "dashboard.avgTemperature.sub": "전체 서버 평균",
    "dashboard.totalPower.sub": "전체 서버 합계",
    "dashboard.nodes": "Prometheus 노드",
    "dashboard.nodes.up": "정상",
    "dashboard.nodes.down": "다운",
    "dashboard.nodes.healthy": "모든 노드 정상",
    "dashboard.avgUptime": "평균 가동 시간",
    "dashboard.avgUptime.sub": "서버 평균 가동 시간",
    "dashboard.avgUptime.days": "일",
    "dashboard.networkIn": "네트워크 수신",
    "dashboard.networkIn.tx": "송신",
    "dashboard.prometheus.unavailable": "Prometheus 연결 불가",
    "dashboard.prometheus.cannotFetch": "실시간 메트릭을 가져올 수 없습니다",

    // Common
    "common.save": "저장",
    "common.cancel": "취소",
    "common.delete": "삭제",
    "common.edit": "수정",
    "common.loading": "로딩 중...",
    "common.language": "언어",
  },
};

export function translate(lang: Language, key: string): string {
  return translations[lang][key] ?? translations.en[key] ?? key;
}
