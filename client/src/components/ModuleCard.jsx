import { Download, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import DataPreviewTable from './DataPreviewTable';

const colorConfig = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    btnPrimary: 'bg-blue-600 hover:bg-blue-700',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    progress: 'bg-blue-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    btnPrimary: 'bg-purple-600 hover:bg-purple-700',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    progress: 'bg-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    btnPrimary: 'bg-orange-600 hover:bg-orange-700',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    progress: 'bg-orange-600',
  },
};

export default function ModuleCard({
  icon,
  title,
  description,
  color,
  loading = false,
  exporting = false,
  data,
  count,
  onFetch,
  onExport,
}) {
  const config = colorConfig[color];
  const hasData = data && data.length > 0;

  return (
    <div
      className={`${config.bg} border ${config.border} rounded-2xl p-6
                  transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`${config.iconBg} w-14 h-14 rounded-xl
                       flex items-center justify-center text-3xl shadow-md border border-white`}
        >
          {icon}
        </div>

        {count !== undefined && (
          <span
            className={`${config.badge} text-xs font-bold
                        px-3 py-1.5 rounded-full border shadow-sm`}
          >
            {count} records
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mb-5">
        <h3 className="font-bold text-gray-900 text-lg mb-2">
          {title}
        </h3>

        <p className="text-gray-600 text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div className="mb-4 h-1.5 bg-white rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full ${config.progress} rounded-full transition-all duration-500 ease-out`}
            style={{
              width: '65%',
              animation: 'progressBar 1.5s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Preview Table */}
      {hasData && !loading && (
        <DataPreviewTable data={data} />
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-3 mt-5">
        <button
          onClick={onFetch}
          disabled={loading}
          className={`${config.btnPrimary} text-white text-sm font-semibold
                      py-3 rounded-xl transition-all duration-200
                      flex items-center justify-center gap-2
                      disabled:opacity-60 disabled:cursor-not-allowed
                      shadow-md hover:shadow-lg active:scale-95`}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Fetch Data</span>
            </>
          )}
        </button>

        <button
          onClick={onExport}
          disabled={!hasData || exporting}
          className="bg-white border-2 border-gray-200 text-gray-700
                     text-sm font-medium py-3 rounded-xl
                     hover:border-gray-300 hover:bg-gray-50
                     transition-all duration-200
                     flex items-center justify-center gap-2
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-sm active:scale-95"
        >
          {exporting ? (
            <>
              <LoadingSpinner size="sm" color="gray" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Export to Excel</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}