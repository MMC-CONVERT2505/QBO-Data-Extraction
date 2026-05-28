import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Shield,
  Lock,
  Eye,
  Database,
  CheckCircle2,
} from 'lucide-react';

import { checkAuth, getAuthUrl } from '../services/api';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        if (res.data.isAuthenticated) {
          navigate('/dashboard');
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleConnect = async () => {
    setLoading(true);

    try {
      const res = await getAuthUrl();
      window.location.href = res.data.url;
    } catch {
      toast.error('Failed to connect to QuickBooks');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600 rounded-2xl mb-6 shadow-2xl">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>

          <p className="text-gray-600 font-medium text-lg">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl mb-5 shadow-xl">
            <FileSpreadsheet className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            QBO Data Extraction
          </h1>

          <p className="text-gray-600 text-base">
            Securely connect your QuickBooks account
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-300/50 overflow-hidden border border-gray-200">
          
          {/* Features Section */}
          <div className="p-8">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">
                Available Modules
              </h3>

              <p className="text-gray-400 text-xs">
                Extract and export allocation data
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: '📄',
                  text: 'Invoice Allocations',
                  desc: 'Payment & CreditMemo allocations',
                  color: 'blue',
                },
                {
                  icon: '🧾',
                  text: 'Bill Allocations',
                  desc: 'BillPayment & VendorCredit allocations',
                  color: 'purple',
                },
                {
                  icon: '💰',
                  text: 'Overpayment Tracking',
                  desc: 'Unapplied payments & unused credits',
                  color: 'orange',
                },
              ].map((item, index) => (
                <div
                  key={item.text}
                  className="group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-md"
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${
                      item.color === 'blue'
                        ? 'bg-blue-50'
                        : item.color === 'purple'
                        ? 'bg-purple-50'
                        : 'bg-orange-50'
                    }`}
                  >
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm mb-0.5">
                      {item.text}
                    </h4>

                    <p className="text-gray-500 text-xs">
                      {item.desc}
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="px-8">
            <div className="border-t border-gray-100"></div>
          </div>

          {/* Actions Section */}
          <div className="p-8">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800
                         disabled:from-green-400 disabled:to-green-500
                         text-white font-bold py-4 px-6 rounded-xl transition-all
                         duration-200 flex items-center justify-center gap-3 text-base
                         shadow-lg hover:shadow-xl disabled:shadow-lg active:scale-[0.98]
                         relative overflow-hidden"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Connect to QuickBooks</span>
                </>
              )}
            </button>

            {/* Security Info */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                <Shield className="w-3.5 h-3.5 text-green-600" />
                <span className="font-medium">
                  OAuth 2.0
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium">
                  Read-only
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-medium">
                  No storage
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges Footer */}
        <div className="mt-8">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span className="font-medium">
                256-bit encryption
              </span>
            </div>

            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="font-medium">
                Bank-grade security
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Powered by Intuit QuickBooks API
          </p>
        </div>
      </div>
    </div>
  );
}