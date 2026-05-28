import { FileSpreadsheet, LogOut } from 'lucide-react';

export default function Navbar({
  companyName,
  lastSync,
  onDisconnect,
}) {
  const formatLastSync = (dateStr) => {
    if (!dateStr) return 'Never';

    const date = new Date(dateStr);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    const diffHours = Math.floor(diffMins / 60);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    return date.toLocaleDateString();
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>

            <div>
              <h1 className="font-bold text-gray-900 text-base">
                QBO Data Extraction
              </h1>

              <p className="text-xs text-gray-500">
                QuickBooks Online
              </p>
            </div>
          </div>

          {/* Center - Company Info */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {companyName || 'Not Connected'}
            </span>

            {companyName && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected
              </span>
            )}
          </div>

          {/* Right - Sync & Disconnect */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-xs text-gray-500">
              Last sync:{' '}
              <span className="font-medium text-gray-700">
                {formatLastSync(lastSync)}
              </span>
            </div>

            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600
                         border border-gray-200 rounded-lg transition-all duration-200
                         hover:text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />

              <span className="hidden sm:inline">
                Disconnect
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}