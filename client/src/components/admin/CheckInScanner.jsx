import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { adminCheckIn, adminListCheckIns, adminSetGuestCount } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

const REGION_ID = 'qr-reader-region';

const RESULT_STYLES = {
  checked_in: { ring: 'border-green-400', badge: 'bg-green-500', label: '✓ CHECKED IN' },
  already_checked_in: { ring: 'border-amber-400', badge: 'bg-amber-500', label: '! ALREADY IN' },
  not_confirmed: { ring: 'border-red-400', badge: 'bg-red-500', label: '✕ NOT CONFIRMED' },
  not_found: { ring: 'border-red-400', badge: 'bg-red-500', label: '✕ NOT FOUND' },
};

// Results that represent an actual (found) registration — worth asking guest count for.
const VALID_RESULTS = new Set(['checked_in', 'already_checked_in']);

/**
 * Camera QR scanner for gate check-in. Scans a student's entry QR (which encodes
 * their registration code), checks them in, and shows a colour-coded result.
 * Falls back to manual code entry if the camera is unavailable. After every
 * successful scan, prompts the gate staff to type the guest count directly
 * (instead of relying on the WhatsApp follow-up reply, which many students
 * never answer).
 */
const CheckInScanner = ({ onCheckedIn }) => {
  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const lastScan = useRef({ code: '', at: 0 });

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [checkedIn, setCheckedIn] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [guestPrompt, setGuestPrompt] = useState(null); // { id, fullName, value } | null
  const [guestSaving, setGuestSaving] = useState(false);

  const loadCheckedIn = useCallback(async () => {
    try {
      const data = await adminListCheckIns();
      setCheckedIn(data.items || []);
    } catch (err) {
      toast.error(err.message || 'Could not load checked-in list');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCheckedIn();
  }, [loadCheckedIn]);

  const handleCode = useCallback(
    async (raw) => {
      const code = String(raw || '').trim();
      if (!code || processingRef.current || guestPrompt) return;

      // Ignore repeat decodes of the same code within 3s (camera fires fast).
      const now = Date.now();
      if (lastScan.current.code === code && now - lastScan.current.at < 3000) return;
      lastScan.current = { code, at: now };

      processingRef.current = true;
      setBusy(true);
      try {
        const res = await adminCheckIn(code);
        const resultKind = res.result || (res.success ? 'checked_in' : 'not_confirmed');
        setResult({ ...res, result: resultKind });
        if (res.success) {
          onCheckedIn?.();
          loadCheckedIn(); // refresh the running checked-in list
        }
        if (VALID_RESULTS.has(resultKind) && res.data?.id) {
          setGuestPrompt({
            id: res.data.id,
            fullName: res.data.fullName,
            value:
              res.data.guestCount === undefined || res.data.guestCount === null
                ? ''
                : String(res.data.guestCount),
          });
        }
      } catch (err) {
        setResult({
          success: false,
          result: 'not_found',
          message: err.message || 'No registration found for this code.',
          data: { registrationNumber: code },
        });
      } finally {
        setBusy(false);
        // Re-arm for the next student after a brief pause.
        setTimeout(() => {
          processingRef.current = false;
        }, 800);
      }
    },
    [onCheckedIn, loadCheckedIn, guestPrompt]
  );

  // Camera start/stop should happen exactly once per mount — not every time
  // `handleCode` gets a new identity (e.g. `onCheckedIn`/`loadList` changes
  // identity whenever the parent's filters change, which would otherwise
  // tear down and restart the live camera mid-scan). Route the QR callback
  // through a ref so the effect below can have empty deps.
  const handleCodeRef = useRef(handleCode);
  useEffect(() => {
    handleCodeRef.current = handleCode;
  }, [handleCode]);

  useEffect(() => {
    if (!document.getElementById(REGION_ID)) return undefined;
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => handleCodeRef.current(decodedText),
        () => {} // ignore per-frame "not found" errors
      )
      .then(() => {
        if (!cancelled) runningRef.current = true;
      })
      .catch((err) => {
        if (!cancelled) setCameraError(err?.message || 'Could not start the camera.');
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && runningRef.current) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
        runningRef.current = false;
      }
    };
  }, []);

  const submitManual = (e) => {
    e.preventDefault();
    if (manual.trim()) handleCode(manual.trim());
  };

  const saveGuestCount = async () => {
    if (!guestPrompt) return;
    const n = Math.trunc(Number(guestPrompt.value));
    if (guestPrompt.value !== '' && (!Number.isFinite(n) || n < 0 || n > 20)) {
      toast.error('Guest count must be a number between 0 and 20');
      return;
    }
    if (guestPrompt.value === '') {
      setGuestPrompt(null);
      return;
    }
    setGuestSaving(true);
    try {
      await adminSetGuestCount(guestPrompt.id, n);
      toast.success('Guest count saved');
      setGuestPrompt(null);
    } catch (err) {
      toast.error(err.message || 'Could not save guest count');
    } finally {
      setGuestSaving(false);
    }
  };

  const style = result ? RESULT_STYLES[result.result] || RESULT_STYLES.not_found : null;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-[#0a1430] p-4 text-white shadow-2xl">
        <h2 className="font-heading text-lg font-bold text-white">Scan entry QR — check-in</h2>

        {cameraError ? (
          <div className="mt-3 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20">
            Camera unavailable: {cameraError} Use manual entry below.
          </div>
        ) : (
          <div id={REGION_ID} className="mt-3 overflow-hidden rounded-xl bg-black" />
        )}

        {result && (
          <div className={`mt-4 rounded-xl border-2 ${style.ring} bg-white/5 p-4`}>
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${style.badge}`}>
                {style.label}
              </span>
              <span className="text-sm font-semibold text-accent">
                {result.data?.registrationNumber || '—'}
              </span>
            </div>
            <p className="mt-2 text-lg font-bold text-white">{result.data?.fullName || '—'}</p>
            {(result.data?.preparingFor || result.data?.schoolOrCollege) && (
              <p className="text-sm text-white/60">
                {[result.data?.preparingFor, result.data?.schoolOrCollege].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="mt-2 text-sm font-medium text-white/80">{result.message}</p>
            {result.data?.checkedInAt && (
              <p className="mt-1 text-xs text-white/50">
                In at {new Date(result.data.checkedInAt).toLocaleString('en-IN')}
                {result.data.checkedInBy ? ` · by ${result.data.checkedInBy}` : ''}
              </p>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
            <Spinner className="h-4 w-4 border-white/40 border-t-white" /> Checking…
          </div>
        )}

        <form onSubmit={submitManual} className="mt-4 flex gap-2">
          <input
            className="input-dark"
            placeholder="Or type code, e.g. NEET CON 001"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap !py-2.5" disabled={busy}>
            Check in
          </button>
        </form>
        <p className="mt-2 text-xs text-white/50">
          Point the camera at the student's QR. Camera access needs HTTPS (or localhost).
        </p>

        {/* Running list of everyone checked in (updates after each scan). */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/80">Checked in</h3>
            <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300">
              {checkedIn.length}
            </span>
          </div>
          {listLoading ? (
            <p className="mt-2 text-xs text-white/40">Loading…</p>
          ) : checkedIn.length === 0 ? (
            <p className="mt-2 text-xs text-white/40">No one checked in yet.</p>
          ) : (
            <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
              {checkedIn.map((p) => (
                <li
                  key={p._id || p.registrationNumber}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{p.fullName}</span>
                    <span className="text-xs text-accent">{p.registrationNumber}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-white/50">
                    {p.checkedInAt
                      ? new Date(p.checkedInAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                    {p.checkedInBy ? (
                      <span className="block text-white/30">{p.checkedInBy}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Guest-count prompt — pops up after every successful scan. */}
      {guestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1430] p-5 text-white shadow-2xl">
            <h3 className="font-heading text-lg font-bold text-white">Guests accompanying?</h3>
            <p className="mt-1 text-sm text-white/60">{guestPrompt.fullName}</p>
            <input
              type="number"
              min={0}
              max={20}
              autoFocus
              className="input-dark mt-3 w-full"
              placeholder="Number of guests (e.g. 0)"
              value={guestPrompt.value}
              onChange={(e) => setGuestPrompt((g) => ({ ...g, value: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && saveGuestCount()}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setGuestPrompt(null)}
                className="btn-ghost-dark !py-2 !px-4 text-sm"
                disabled={guestSaving}
              >
                Skip
              </button>
              <button
                onClick={saveGuestCount}
                className="btn-primary !py-2 !px-4 text-sm"
                disabled={guestSaving}
              >
                {guestSaving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInScanner;
