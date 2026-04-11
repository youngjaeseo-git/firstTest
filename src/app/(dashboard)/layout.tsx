import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-y-auto scrollbar-thin">
          {/* Subtle gradient background */}
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.04),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.03),transparent_50%)]" />
          <div className="relative p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
