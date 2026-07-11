import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListCheckIns } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

/**
 * Read-only roster of everyone checked in so far — regardless of whether
 * they were checked in by camera scan, typed registration code, or manual
 * entry (all three go through the same check-in action, so there's nothing
 * to distinguish here beyond who did it and when).
 */
const CheckedInList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await adminListCheckIns();
      setItems(data.items || []);
    } catch (err) {
      toast.error(err.message || 'Could not load checked-in list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-white">Checked-in students</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300">
            {items.length}
          </span>
          <button
            onClick={() => load(true)}
            className="btn-ghost-dark !py-1.5 !px-3 text-xs"
            disabled={refreshing}
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5 border-white/40 border-t-white" /> : '↻ Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-white/40">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">No one checked in yet.</p>
      ) : (
        <ul className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto">
          {items.map((p) => (
            <li
              key={p._id || p.registrationNumber}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">{p.fullName}</span>
                <span className="text-xs text-accent">{p.registrationNumber}</span>
                {(p.preparingFor || p.schoolOrCollege) && (
                  <span className="block truncate text-xs text-white/40">
                    {[p.preparingFor, p.schoolOrCollege].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span
                  className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70"
                  title="Guests accompanying"
                >
                  👥 {p.guestCount === undefined || p.guestCount === null ? '—' : p.guestCount}
                </span>
                <span className="text-right text-xs text-white/50">
                  {p.checkedInAt
                    ? new Date(p.checkedInAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                  {p.checkedInBy ? <span className="block text-white/30">by {p.checkedInBy}</span> : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CheckedInList;
