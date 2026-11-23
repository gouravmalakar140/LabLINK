import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Sparkles, X } from 'lucide-react';
import type {
  BayTrack,
  BookingRequest,
  ConflictDetail,
  Department,
  LabStation,
} from '../types/lablink.ts';
import { addDaysIso, DEPARTMENTS, formatHour } from '../utils/format.ts';

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
  initialStartHour?: number;
  todayDate: string;
  onClose: () => void;
  onSuccess: (request: BookingRequest) => void;
  onResolveWithAi: (prefill: ConflictPrefill) => void;
}

export function BookingModal({
  isOpen,
  stations,
  initialStation,
  initialStartHour,
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
  const [projectDeadline, setProjectDeadline] = useState(addDaysIso(todayDate, 2));
  const [date, setDate] = useState(todayDate);
  const [startHour, setStartHour] = useState(initialStartHour ?? 14);
  const [duration, setDuration] = useState(2);
  const [bayTrack, setBayTrack] = useState<BayTrack>('cross_dept_bay');
  const [seatsRequested, setSeatsRequested] = useState(2);
  const [safetyCleared, setSafetyCleared] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictDetail, setConflictDetail] = useState<ConflictDetail | null>(null);

  const endHour = Math.min(21, startHour + duration);

  useEffect(() => {
    if (isOpen) {
      setStationId(initialStation?.id ?? stations[0]?.id ?? 'bio-204');
      setDate(todayDate);
      setProjectDeadline(addDaysIso(todayDate, 2));
      if (initialStartHour !== undefined) {
        setStartHour(Math.min(19, Math.max(8, initialStartHour)));
      }
      setErrorMsg(null);
      setConflictDetail(null);
    }
  }, [isOpen, initialStation, initialStartHour, stations, todayDate]);

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
    setProjectDeadline(addDaysIso(todayDate, 1));
    setStartHour(14);
    setDuration(2);
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
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="booking-modal-title" className="text-lg font-semibold text-slate-900">
              Book Lab Station
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Reserve an open bay or trigger AI resolution on peak conflicts.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-600">
              Test conflict recovery:
            </span>
            <button
              type="button"
              onClick={loadConflictPreset}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
            >
              Load Peak CS-102 Conflict
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="booking-station" className="block text-xs font-semibold text-slate-700 mb-1">
                Lab Station
              </label>
              <select
                id="booking-station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.department} ({s.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="booking-track" className="block text-xs font-semibold text-slate-700 mb-1">
                Access Track
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
                  Primary Gear ({selectedStation?.primaryTrack.title})
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="student-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Your Name
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
              <label htmlFor="student-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                Department
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="project-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Project Title
              </label>
              <input
                id="project-title"
                type="text"
                required
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="project-deadline" className="block text-xs font-semibold text-slate-700 mb-1">
                Deadline
              </label>
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

          <div>
            <label htmlFor="required-specs" className="block text-xs font-semibold text-slate-700 mb-1">
              Required Tools / Specs
            </label>
            <input
              id="required-specs"
              type="text"
              required
              value={requiredSpecs}
              onChange={(e) => setRequiredSpecs(e.target.value)}
              placeholder="e.g., CUDA 12, SolidWorks, Oscilloscope"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="slot-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Date
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
              <label htmlFor="start-hour" className="block text-xs font-semibold text-slate-700 mb-1">
                Start
              </label>
              <select
                id="start-hour"
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {Array.from({ length: 13 }, (_, idx) => idx + 8).map((h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1">Duration</span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {[1, 2, 3].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDuration(hrs)}
                    className={`py-1 text-xs font-mono tabular-nums font-semibold rounded-md cursor-pointer transition-colors ${
                      duration === hrs
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="seats-requested" className="block text-xs font-semibold text-slate-700 mb-1">
                Bays
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

          <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              id="safety-cleared"
              type="checkbox"
              checked={safetyCleared}
              onChange={(e) => setSafetyCleared(e.target.checked)}
              className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
            />
            <label htmlFor="safety-cleared" className="text-xs text-slate-700 cursor-pointer flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-slate-900">Safety orientation cleared</strong> ({selectedStation?.safetyTier})
              </span>
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
                    {conflictDetail ? 'Slot Full' : 'Cannot Reserve'}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900">{errorMsg}</p>
                </div>
              </div>

              {conflictDetail && (
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
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Find Open Alternate Bay with AI</span>
                </button>
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
              {submitting ? 'Checking…' : `Book ${formatHour(startHour)}–${formatHour(endHour)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
