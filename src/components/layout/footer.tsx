export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-auto">
      {/* SK hynix brand gradient bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#FF8200] via-[#EA002C] to-[#B5008E]" />
      <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-800/60 bg-gray-900/40 px-6 py-4 sm:flex-row">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold tracking-tight text-gray-200">DC Express</span>
          <span className="text-gray-700">|</span>
          <span className="font-medium text-gray-400">DRAM AE</span>
        </div>
        <p className="text-xs text-gray-600">
          © {year} SK hynix · DRAM AE · DC Express
        </p>
      </div>
    </footer>
  );
}
