import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Clock, ShieldCheck, Sparkles, X } from 'lucide-react';
import type {
  BayTrack,
  BookingRequest,
  ConflictDetail,
  Department,
  LabStation,
} from '../types/lablink.ts';

export interface ConflictPrefill {
  stationId: string;
  studentName: string;
  studentDepartment: Department;
  projectTitle: string;
  requiredSpecs: string;
  projectDeadline: string;
  date: string;
  startHour: number;
  endHour: number;
  bayTrack: BayTrack;
  seatsRequested: number;
  conflict: ConflictDetail;
}

interface BookingModalProps {
  isOpen: boolean;
  stations: LabStation[];
  initialStation: LabStation | null;
  todayDate: string;
  onClose: () => void;
  onSuccess: (request: BookingRequest) => void;
  onResolveWithAi: (prefill: ConflictPrefill) => void;
}

const DEPARTMENTS: Department[] = ['CS & AI', 'Biotech', 'Aero & Mech', 'Electronics'];

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function BookingModal({
  isOpen,
  stations,
  initialStation,
  todayDate,
  onClose,
  onSuccess,
  onResolveWithAi,
}: BookingModalProps) {
  const [stationId, setStationId] = useState(initialStation?.id ?? stations[0]?.id ?? 'bio-204');
  const [studentName, setStudentName] = useState('Ishaan Kulkarni');
  const [studentDepartment, setStudentDepartment] = useState<Department>('CS & AI');
  const [projectTitle, setProjectTitle] = useState('Real-Time Edge Vision Inference Benchmark');
  const [requiredSpecs, setRequiredSpecs] = useState('RTX 4080, PyTorch / CUDA 12, Python 3.12');
  const [projectDeadline, setProjectDeadline] = useState(addDays(todayDate, 2));
  const [date, setDate] = useState(todayDate);
  const [startHour, setStartHour] = useState(14);
  const [endHour, setEndHour] = useState(16);
  const [bayTrack, setBayTrack] = useState<BayTrack>('cross_dept_bay');
  const [seatsRequested, setSeatsRequested] = useState(2);
  const [safetyCleared, setSafetyCleared] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictDetail, setConflictDetail] = useState<ConflictDetail | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStationId(initialStation?.id ?? stations[0]?.id ?? 'bio-204');
      setDate(todayDate);
      setProjectDeadline(addDays(todayDate, 2));
      setErrorMsg(null);
      setConflictDetail(null);
    }
  }, [isOpen, initialStation, stations, todayDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedStation = stations.find((s) => s.id === stationId) ?? stations[0];

  const loadConflictPreset = () => {
    setStationId('cs-102');
    setStudentName('Ananya Rao');
    setStudentDepartment('CS & AI');
    setProjectTitle('Multi-Modal Capstone Model Fine-Tuning');
    setRequiredSpecs('RTX 4080, CUDA 12, PyTorch, 32GB+ RAM');
    setDate(todayDate);
    setProjectDeadline(addDays(todayDate, 1));
    setStartHour(14);
    setEndHour(16);
    setBayTrack('cross_dept_bay');
    setSeatsRequested(2);
    setErrorMsg(null);
    setConflictDetail(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setConflictDetail(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          studentName,
          studentDepartment,
          projectTitle,
          requiredSpecs,
          projectDeadline,
          date,
          startHour,
          endHour,
          bayTrack,
          seatsRequested,
          safetyCleared,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        setConflictDetail(data.conflict as ConflictDetail);
        setErrorMsg(data.error || 'Scheduling conflict detected.');
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Could not submit access request.');
        return;
      }

      onSuccess(data.request as BookingRequest);
    } catch {
      setErrorMsg('Network error while connecting to the LabLink server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="booking-modal-title" className="text-lg font-semibold text-slate-900">
              Project-Based Lab Access Request
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Book a shareable cross-departmental bay or request primary equipment clearance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking dialog"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-600">
              Need to demo conflict resolution? Try the saturated CS-102 peak slot.
            </span>
            <button
              type="button"
              onClick={loadConflictPreset}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
            >
              Load Peak CS-102 Conflict Preset
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="booking-station" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Hybrid Station
              </label>
              <select
                id="booking-station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="booking-track" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Resource Track
              </label>
              <select
                id="booking-track"
                value={bayTrack}
                onChange={(e) => setBayTrack(e.target.value as BayTrack)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="cross_dept_bay">
                  Shareable Bay ({selectedStation?.shareableTrack.title})
                </option>
                <option value="primary_equipment">
                  Primary Equipment ({selectedStation?.primaryTrack.title})
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Student / Team Lead Name
              </label>
              <input
                id="student-name"
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="student-dept" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Home Department
              </label>
              <select
                id="student-dept"
                value={studentDepartment}
                onChange={(e) => setStudentDepartment(e.target.value as Department)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="project-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project Title
              </label>
              <input
                id="project-title"
                type="text"
                required
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g., Autonomous Drone CAD & CFD Analysis"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="project-deadline" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project Deadline (Used for Fairness Priority)
              </label>
              <div className="relative">
                <input
                  id="project-deadline"
                  type="date"
                  required
                  value={projectDeadline}
                  onChange={(e) => setProjectDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="required-specs" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Required Software, Compute, or Equipment Specs
            </label>
            <input
              id="required-specs"
              type="text"
              required
              value={requiredSpecs}
              onChange={(e) => setRequiredSpecs(e.target.value)}
              placeholder="e.g., CUDA 12, PyTorch, SolidWorks, 200MHz Oscilloscope"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="slot-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                Session Date
              </label>
              <input
                id="slot-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="start-hour" className="block text-xs font-semibold text-slate-700 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                Start Hour
              </label>
              <select
                id="start-hour"
                value={startHour}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setStartHour(next);
                  if (endHour <= next) setEndHour(Math.min(21, next + 2));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {Array.from({ length: 13 }, (_, idx) => idx + 8).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="end-hour" className="block text-xs font-semibold text-slate-700 mb-1.5">
                End Hour
              </label>
              <select
                id="end-hour"
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {Array.from({ length: 13 }, (_, idx) => idx + 9)
                  .filter((h) => h > startHour && h <= 21)
                  .map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="seats-requested" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Workstations
              </label>
              <input
                id="seats-requested"
                type="number"
                min={1}
                max={8}
                value={seatsRequested}
                onChange={(e) => setSeatsRequested(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              id="safety-cleared"
              type="checkbox"
              checked={safetyCleared}
              onChange={(e) => setSafetyCleared(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-700 rounded cursor-pointer"
            />
            <label htmlFor="safety-cleared" className="text-xs text-slate-700 leading-relaxed cursor-pointer">
              <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Departmental Safety Clearance Completed
              </span>{' '}
              — Target station requires{' '}
              <span className="font-semibold">{selectedStation?.safetyTier}</span> compliance.
              Uncheck if you need a faculty safety orientation slot.
            </label>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm text-amber-950">
                  <p className="font-semibold">
                    {conflictDetail ? 'Scheduling Conflict Detected' : 'Unable to Reserve Slot'}
                  </p>
                  <p className="mt-0.5 text-amber-900">{errorMsg}</p>
                </div>
              </div>

              {conflictDetail && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200">
                  <p className="text-xs text-amber-900">
                    Let Gemini AI find an open cross-departmental bay matching your deadline and specs.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onResolveWithAi({
                        stationId,
                        studentName,
                        studentDepartment,
                        projectTitle,
                        requiredSpecs,
                        projectDeadline,
                        date,
                        startHour,
                        endHour,
                        bayTrack,
                        seatsRequested,
                        conflict: conflictDetail,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resolve With Smart Allocator</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Checking Availability…' : 'Submit Access Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
