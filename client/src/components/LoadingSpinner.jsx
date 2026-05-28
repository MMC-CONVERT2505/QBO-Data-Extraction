export default function LoadingSpinner({
  size = 'md',
  color = 'white',
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-6 h-6 border-2',
  };

  const colorClasses = {
    white: 'border-white border-t-transparent',
    gray: 'border-gray-600 border-t-transparent',
    blue: 'border-blue-600 border-t-transparent',
    green: 'border-green-600 border-t-transparent',
  };

  return (
    <div
      className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
    />
  );
}