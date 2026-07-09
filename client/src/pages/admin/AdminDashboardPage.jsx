import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAdmin } from '../../hooks/useAdmin.js';
import {
  adminSummary,
  adminListRegistrations,
  adminGetRegistration,
  adminExport,
} from '../../services/api.js';
import Logo from '../../components/ui/Logo.jsx';
import SummaryCards from '../../components/admin/SummaryCards.jsx';
import RegistrationsTable from '../../components/admin/RegistrationsTable.jsx';
import RegistrationDetailModal from '../../components/admin/RegistrationDetailModal.jsx';
import CheckInScanner from '../../components/admin/CheckInScanner.jsx';
import { Spinner } from '../../components/ui/PageLoader.jsx';

const STATUS_OPTIONS = ['All', 'CONFIRMED', 'FREE', 'PENDING', 'FAILED', 'MANUAL'];
const PREP_OPTIONS = ['All', 'NEET 2027', 'NEET 2028'];
const GUEST_INFO_OPTIONS = [
  { value: 'All', label: 'All (guest info)' },
  { value: 'needsReview', label: '⚠️ Needs review (unparsed reply)' },
  { value: 'notAnswered', label: 'Awaiting guest count' },
];

const AdminDashboardPage = () => {
  const { admin, isAdminRole, logout } = useAdmin();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [data, setData] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [listLoading, setListLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    preparingFor: 'All',
    guestInfo: 'All',
    page: 1,
  });
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const searchTimer = useRef(null);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await adminSummary());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setListLoading(true);
    try {
      const params = { page: filters.page, limit: 20 };
      if (filters.status !== 'All') params.status = filters.status;
      if (filters.preparingFor !== 'All') params.preparingFor = filters.preparingFor;
      if (filters.guestInfo !== 'All') params.guestInfo = filters.guestInfo;
      if (filters.search.trim()) params.search = filters.search.trim();
      const result = await adminListRegistrations(params);
      if (requestId !== listRequestId.current) return; // a newer request already landed
      setData(result);
    } catch (err) {
      if (requestId !== listRequestId.current) return;
      toast.error(err.message);
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Debounced search input.
  const onSearch = (value) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 350);
  };

  const openRow = async (row) => {
    // Open immediately with list data, then refresh with full detail.
    const requestId = ++detailRequestId.current;
    setSelected(row);
    try {
      const full = await adminGetRegistration(row._id);
      if (requestId !== detailRequestId.current) return; // a newer row was opened meanwhile
      setSelected(full);
    } catch (err) {
      if (requestId !== detailRequestId.current) return;
      toast.error(err.message || 'Could not load full details — showing list data only');
    }
  };

  const handleUpdated = (updated) => {
    setSelected(updated);
    setData((d) => ({
      ...d,
      items: d.items.map((it) => (it._id === updated._id ? updated : it)),
    }));
    loadSummary();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await adminExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neetcon2026-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen bg-[#050c20] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081231]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo dark />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/60 sm:inline">
              {admin?.username}{' '}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase text-white/80">
                {admin?.role}
              </span>
            </span>
            <button onClick={handleLogout} className="btn-ghost-dark !py-2 !px-4 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-white">Dashboard</h1>
            <p className="text-sm text-white/60">NEET CON 2026 registrations overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScanning(true)} className="btn-ghost-dark !py-2.5">
              📷 Scan / Check-in
            </button>
            {isAdminRole && (
              <button onClick={handleExport} className="btn-primary !py-2.5" disabled={exporting}>
                {exporting ? (
                  <>
                    <Spinner /> Exporting…
                  </>
                ) : (
                  '⬇ Export to Excel'
                )}
              </button>
            )}
          </div>
        </div>

        <SummaryCards summary={summary} loading={summaryLoading} />

        {/* Filters */}
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-4">
          <input
            className="input-dark"
            placeholder="Search name, mobile, email, reg no…"
            onChange={(e) => onSearch(e.target.value)}
          />
          <select
            className="input-dark"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-[#081231] text-white">
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <select
            className="input-dark"
            value={filters.preparingFor}
            onChange={(e) => setFilters((f) => ({ ...f, preparingFor: e.target.value, page: 1 }))}
          >
            {PREP_OPTIONS.map((p) => (
              <option key={p} value={p} className="bg-[#081231] text-white">
                {p === 'All' ? 'All (NEET 2027/2028)' : p}
              </option>
            ))}
          </select>
          <select
            className="input-dark"
            value={filters.guestInfo}
            onChange={(e) => setFilters((f) => ({ ...f, guestInfo: e.target.value, page: 1 }))}
          >
            {GUEST_INFO_OPTIONS.map((g) => (
              <option key={g.value} value={g.value} className="bg-[#081231] text-white">
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <RegistrationsTable
          items={data.items}
          loading={listLoading}
          pagination={data.pagination}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onRowClick={openRow}
        />
      </main>

      {selected && (
        <RegistrationDetailModal
          registration={selected}
          isAdminRole={isAdminRole}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}

      {scanning && (
        <CheckInScanner onClose={() => setScanning(false)} onCheckedIn={loadList} />
      )}
    </div>
  );
};

export default AdminDashboardPage;
