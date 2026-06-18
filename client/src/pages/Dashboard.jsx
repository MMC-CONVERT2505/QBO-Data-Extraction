

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import StatsBar from '../components/StatsBar';
import ModuleCard from '../components/ModuleCard';
import { Shield } from 'lucide-react';
import Modal from '../components/Modal';
import axios from 'axios';
import {
  checkAuth,
  logout,
  getInvoiceAllocations,
  getBillAllocations,
  getAPOverpayments,
  getAROverpayments,
  exportInvoiceAllocations,
  exportBillAllocations,
  exportAPOverpayments,
  exportAROverpayments,
} from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [lastExport, setLastExport] = useState(undefined);

  const [invoiceState, setInvoiceState] = useState({ loading: false, exporting: false });
  const [billState, setBillState] = useState({ loading: false, exporting: false });
  const [apState, setApState] = useState({ loading: false, exporting: false });
  const [arState, setArState] = useState({ loading: false, exporting: false });
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });


  const [modal, setModal] = useState({ open: false, title: '', data: null, exportFn: null, filename: '', state: null, setState: null });

  const openModal = (title, data, exportFn, filename, state, setState) => {
    setModal({ open: true, title, data, exportFn, filename, state, setState });
  };

  const closeModal = () => setModal(prev => ({ ...prev, open: false }));


  useEffect(() => {
    const fetchAuth = async () => {
      try {
        // ── URL mein auth token check karo ──
        const urlParams = new URLSearchParams(window.location.search);
        const authParam = urlParams.get('auth');

        if (authParam) {
          const decoded = JSON.parse(atob(authParam));
          const { sessionId } = decoded;

          if (sessionId) {
            localStorage.setItem('qbo_session_id', sessionId);
            await axios.post('/api/auth/set-session', { sessionId }, {
              headers: { 'x-qbo-session': sessionId }
            });
          }

          window.history.replaceState({}, '', '/dashboard');
        }

        const res = await checkAuth();
        if (res.data.isAuthenticated) {
          setIsAuthenticated(true);
          setCompanyName(res.data.companyName || 'Production Company');
          setLastSync(new Date().toLocaleTimeString());
        } else {
          navigate('/');
        }
      } catch {
        navigate('/');
      }
    };
    fetchAuth();
  }, []);


  const handleDisconnect = async () => {
    try {
      await logout();
      localStorage.removeItem('qbo_session_id'); // ✅ local session bhi clear karo
      toast.success('Disconnected successfully');
      navigate('/');
    } catch {
      localStorage.removeItem('qbo_session_id'); // ✅ failure pe bhi clear karo
      toast.error('Failed to disconnect');
    }
  };

  // ── handleFetch functions mein date pass karo ──
  const handleFetchInvoices = async () => {
    setInvoiceState(prev => ({ ...prev, loading: true }));
    try {
      const res = await getInvoiceAllocations(dateRange.startDate, dateRange.endDate);
      const newState = { loading: false, exporting: false, data: res.data.data, count: res.data.count };
      setInvoiceState(newState);
      toast.success(`${res.data.count} invoice records fetched successfully`);
      openModal('Invoice Allocations', res.data.data,
        () => exportInvoiceAllocations(dateRange.startDate, dateRange.endDate),
        'Invoice_Allocations', newState, setInvoiceState);
    } catch {
      setInvoiceState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to fetch invoice data');
    }
  };


  const handleFetchBills = async () => {
    setBillState(prev => ({ ...prev, loading: true }));
    try {
      const res = await getBillAllocations(dateRange.startDate, dateRange.endDate);
      const newState = { loading: false, exporting: false, data: res.data.data, count: res.data.count };
      setBillState(newState);
      toast.success(`${res.data.count} bill records fetched successfully`);
      openModal('Bill Allocations', res.data.data,
        () => exportBillAllocations(dateRange.startDate, dateRange.endDate),
        'Bill_Allocations', newState, setBillState);
    } catch {
      setBillState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to fetch bill data');
    }
  };


  const handleFetchAP = async () => {
    setApState(prev => ({ ...prev, loading: true }));
    try {
      const res = await getAPOverpayments(dateRange.startDate, dateRange.endDate);
      const newState = { loading: false, exporting: false, data: res.data.data, count: res.data.count };
      setApState(newState);
      toast.success(`${res.data.count} AP overpayment records fetched successfully`);
      openModal('AP Overpayments', res.data.data,
        () => exportAPOverpayments(dateRange.startDate, dateRange.endDate),
        'AP_Overpayments', newState, setApState);
    } catch {
      setApState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to fetch AP overpayment data');
    }
  };



  const handleFetchAR = async () => {
    setArState(prev => ({ ...prev, loading: true }));
    try {
      const res = await getAROverpayments(dateRange.startDate, dateRange.endDate);
      const newState = { loading: false, exporting: false, data: res.data.data, count: res.data.count };
      setArState(newState);
      toast.success(`${res.data.count} AR overpayment records fetched successfully`);
      openModal('AR Overpayments', res.data.data,
        () => exportAROverpayments(dateRange.startDate, dateRange.endDate),
        'AR_Overpayments', newState, setArState);
    } catch {
      setArState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to fetch AR overpayment data');
    }
  };

  const handleExport = async (exportFn, filename, setState, currentState) => {
    setModal(prev => ({ ...prev, state: { ...prev.state, exporting: true } }));
    setState({ ...currentState, exporting: true });
    try {
      const res = await exportFn();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLastExport(new Date().toISOString());
      toast.success('Excel file downloaded successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setState({ ...currentState, exporting: false });
      setModal(prev => ({ ...prev, state: { ...prev.state, exporting: false } }));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Connecting to QuickBooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        companyName={companyName}
        lastSync={lastSync}
        onDisconnect={handleDisconnect}
      />

      <StatsBar
        invoiceCount={invoiceState.count ?? 0}
        billCount={billState.count ?? 0}
        overpaymentCount={(apState.count ?? 0) + (arState.count ?? 0)}
        lastExport={lastExport}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Allocation Modules</h2>
          <p className="text-gray-600 text-base">
            Select a module to fetch and export data from QuickBooks
          </p>
        </div>

        {/* ── Date Range Filter ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={() => setDateRange({ startDate: '', endDate: '' })}
            className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Filter
          </button>
          {(dateRange.startDate || dateRange.endDate) && (
            <span className="text-xs text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg">
              Filter active: {dateRange.startDate || 'Any'} → {dateRange.endDate || 'Any'}
            </span>
          )}
        </div>
        {/* ── Row 1: Invoice + Bill ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <ModuleCard
            icon="📄"
            title="Invoice Allocations"
            description="Track how customer payments and credits are allocated across invoices."
            color="blue"
            loading={invoiceState.loading}
            exporting={invoiceState.exporting}
            data={invoiceState.data}
            count={invoiceState.count}
            onFetch={handleFetchInvoices}
            onExport={() => handleExport(
              exportInvoiceAllocations,
              'Invoice_Allocations',
              setInvoiceState,
              invoiceState
            )}
          />

          <ModuleCard
            icon="🧾"
            title="Bill Allocations"
            description="Track how vendor payments and credits are allocated across bills."
            color="purple"
            loading={billState.loading}
            exporting={billState.exporting}
            data={billState.data}
            count={billState.count}
            onFetch={handleFetchBills}
            onExport={() => handleExport(
              exportBillAllocations,
              'Bill_Allocations',
              setBillState,
              billState
            )}
          />

          <ModuleCard
            icon="💸"
            title="AP Overpayments"
            description="Track vendor overpayments and unused credits in Accounts Payable."
            color="orange"
            loading={apState.loading}
            exporting={apState.exporting}
            data={apState.data}
            count={apState.count}
            onFetch={handleFetchAP}
            onExport={() => handleExport(
              exportAPOverpayments,
              'AP_Overpayments',
              setApState,
              apState
            )}
          />

          <ModuleCard
            icon="💰"
            title="AR Overpayments"
            description="Track customer overpayments and unused credits in Accounts Receivable."
            color="green"
            loading={arState.loading}
            exporting={arState.exporting}
            data={arState.data}
            count={arState.count}
            onFetch={handleFetchAR}
            onExport={() => handleExport(
              exportAROverpayments,
              'AR_Overpayments',
              setArState,
              arState
            )}
          />
        </div>

        <div className="border-t border-gray-200 pt-8 mt-12">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-700">OAuth 2.0 Secure Connection</span>
            </div>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span className="text-gray-600">Data never stored on our servers</span>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span className="text-green-600 font-semibold">Powered by QuickBooks API</span>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal
          data={modal.data}
          title={modal.title}
          exporting={modal.state?.exporting}
          onClose={closeModal}
          onExport={() => handleExport(
            modal.exportFn,
            modal.filename,
            modal.setState,
            modal.state
          )}
        />
      )}



      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#333',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            borderRadius: '12px',
            padding: '14px 18px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </div>
  );
}