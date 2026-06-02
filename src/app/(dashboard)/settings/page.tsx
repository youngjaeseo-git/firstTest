export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/rbac";
import {
  Users,
  Radar,
  Bell,
  Cpu,
  Stethoscope,
  ShieldCheck,
  Settings as SettingsIcon,
} from "lucide-react";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const isAdmin = user?.role === "ADMIN";

  const items = [
    {
      href: "/settings/users",
      title: "사용자 관리",
      description: "사용자 계정 생성, 역할 변경, 삭제",
      icon: Users,
      adminOnly: true,
    },
    {
      href: "/settings/discovery",
      title: "Prometheus Discovery",
      description: "Prometheus 타겟 동기화 및 확인",
      icon: Radar,
      adminOnly: false,
    },
    {
      href: "/settings/bmc",
      title: "BMC 관리",
      description: "일괄 하드웨어 정보 갱신 및 전원 제어",
      icon: Cpu,
      adminOnly: true,
    },
    {
      href: "/settings/prometheus-diagnostic",
      title: "Prometheus 진단",
      description: "설정 문제 감지: 중복 스크래핑, 고아 타겟, IP 전용 타겟",
      icon: Stethoscope,
      adminOnly: false,
    },
    {
      href: "/settings/expiry-tracker",
      title: "만기 관리",
      description: "인증서, 라이선스, 보증 만기일 추적 및 자동 알림",
      icon: ShieldCheck,
      adminOnly: false,
    },
    {
      href: "/alerts/rules",
      title: "알림 규칙",
      description: "PromQL 기반 알림 규칙 관리",
      icon: Bell,
      adminOnly: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-400">
          시스템 설정 및 관리 — 현재 로그인:{" "}
          <span className="font-mono text-gray-300">
            {user?.email} ({user?.role})
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const disabled = item.adminOnly && !isAdmin;
          const Icon = item.icon;
          const content = (
            <Card
              className={`h-full transition-colors ${
                disabled
                  ? "opacity-50"
                  : "hover:border-blue-600 hover:bg-blue-600/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-600/10 p-2 text-blue-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-100">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {item.description}
                  </p>
                  {disabled && (
                    <p className="mt-2 text-xs text-amber-400">
                      Admin 권한 필요
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
          return disabled ? (
            <div key={item.href}>{content}</div>
          ) : (
            <Link key={item.href} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-800 p-2 text-gray-400">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-100">시스템 정보</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt className="text-gray-400">버전</dt>
              <dd className="font-mono text-gray-200">0.1.0</dd>
              <dt className="text-gray-400">환경</dt>
              <dd className="font-mono text-gray-200">
                {process.env.NODE_ENV}
              </dd>
              <dt className="text-gray-400">Prometheus</dt>
              <dd className="truncate font-mono text-gray-200">
                {process.env.PROMETHEUS_URL || "(미설정)"}
              </dd>
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}
