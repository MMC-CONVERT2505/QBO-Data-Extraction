export default function DataPreviewTable({
  data,
  maxRows = 5,
  maxCols = 3,
}) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]).slice(0, maxCols);
  const rows = data.slice(0, maxRows);

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-gray-700 font-semibold whitespace-nowrap border-b border-gray-200"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-gray-600">
                    <div
                      className="truncate max-w-[150px]"
                      title={formatValue(row[col])}
                    >
                      {formatValue(row[col])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length > maxRows && (
        <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-500 border-t border-gray-200 font-medium">
          +{data.length - maxRows} more rows
        </div>
      )}
    </div>
  );
}