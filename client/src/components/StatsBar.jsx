import {
  FileText,
  Receipt,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export default function StatsBar({
  invoiceCount,
  billCount,
  overpaymentCount,
  lastExport,
}) {
  const stats = [
    {
      label: 'Total Invoices Fetched',
      value: invoiceCount,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      label: 'Total Bills Fetched',
      value: billCount,
      icon: Receipt,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
    {
      label: 'Overpayments Found',
      value: overpaymentCount,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100',
    },
    {
      label: 'Last Export Date',
      value:
        lastExport && lastExport !== 'Never'
          ? new Date(lastExport).toLocaleDateString()
          : 'Never',
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
      isText: true,
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`p-5 rounded-xl border ${stat.borderColor} ${stat.bgColor}
                            hover:shadow-md transition-all duration-200`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>

                  <span className="text-xs text-gray-600 font-medium leading-tight">
                    {stat.label}
                  </span>
                </div>

                <p
                  className={`text-2xl font-bold text-gray-900 ${
                    stat.isText ? 'text-lg' : ''
                  }`}
                >
                  {stat.isText && typeof stat.value === 'string'
                    ? stat.value
                    : stat.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}