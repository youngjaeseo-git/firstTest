import { prisma } from "@/lib/db";
import { SeverityBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    include: { rule: true, acknowledgement: { include: { user: true } } },
    orderBy: { firedAt: "desc" },
    take: 500,
  });

  // Group by date
  const grouped = alerts.reduce(
    (acc, alert) => {
      const date = alert.firedAt.toISOString().split("T")[0];
      (acc[date] = acc[date] || []).push(alert);
      return acc;
    },
    {} as Record<string, typeof alerts>,
  );

  const dates = Object.keys(grouped).sort().reverse();

  // Stats
  const firing = alerts.filter((a) => a.status === "FIRING").length;
  const acknowledged = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolved = alerts.filter((a) => a.status === "RESOLVED").length;

  // Category counts
  const categories = alerts.reduce(
    (acc, a) => {
      const cat = a.category || "기타";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-gray-400">Firing</p>
          <p className="text-2xl font-bold text-red-400">{firing}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Acknowledged</p>
          <p className="text-2xl font-bold text-amber-400">{acknowledged}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Resolved</p>
          <p className="text-2xl font-bold text-green-400">{resolved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Total</p>
          <p className="text-2xl font-bold">{alerts.length}</p>
        </Card>
      </div>

      {/* Category filter badges */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => (
            <Badge key={cat} variant="default">
              {cat} ({count})
            </Badge>
          ))}
      </div>

      {/* Date-grouped accordion */}
      {dates.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          알림 내역이 없습니다.
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={dates.slice(0, 3)}>
          {dates.map((date) => (
            <AccordionItem key={date} value={date}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold">{date}</span>
                  <Badge>{grouped[date].length}건</Badge>
                  {grouped[date].some((a) => a.status === "FIRING") && (
                    <Badge variant="critical">
                      {grouped[date].filter((a) => a.status === "FIRING").length} firing
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {grouped[date].map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-800/30 p-3"
                    >
                      <SeverityBadge severity={alert.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {alert.summary}
                        </p>
                        {alert.details && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {alert.details}
                          </p>
                        )}
                        <div className="mt-1 flex gap-3 text-xs text-gray-500">
                          {alert.source && <span>Source: {alert.source}</span>}
                          {alert.category && <span>Category: {alert.category}</span>}
                          <span>
                            {alert.firedAt.toLocaleTimeString("ko-KR")}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          alert.status === "FIRING"
                            ? "critical"
                            : alert.status === "ACKNOWLEDGED"
                              ? "warning"
                              : "active"
                        }
                      >
                        {alert.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
