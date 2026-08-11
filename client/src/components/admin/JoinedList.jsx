import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListJoined } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

/**
 * Read-only roster of everyone an admin has marked as having joined the
 * event's official WhatsApp group. There's no automated way to detect a
 * group join via the WhatsApp Cloud API, so this is a manual admin toggle
 * (see the "Mark Joined" action in RegistrationDetailModal) rather than a
 * live scan — replaces the old physical-gate check-in list.
 */
const JoinedList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await adminListJoined();
      setItems(data.items || []);
    } catch (err) {
      toast.error(err.message || 'Could not load joined list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-white">Joined WhatsApp group</h2>
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
          <p className="mt-3 text-sm text-white/40">No one marked as joined yet.</p>
        ) : (
          <ul className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto">
            {items.map((p) => (
              <li
                key={p._id || p.registrationNumber}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{p.fullName}</span>
                  <span className="text-xs text-accent">{p.registrationNumber}</span>
                  {(p.dopaStatus || p.schoolOrCollege) && (
                    <span className="block truncate text-xs text-white/40">
                      {[p.dopaStatus, p.schoolOrCollege].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="text-right text-xs text-white/50">
                  {p.joinedAt
                    ? new Date(p.joinedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                  {p.joinedBy ? <span className="block text-white/30">by {p.joinedBy}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default JoinedList;
