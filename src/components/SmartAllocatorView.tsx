import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  AiAllocationResponse,
  AiRecommendationItem,
  BookingRequest,
  Department,
  LabStation,
} from '../types/lablink.ts';
import type { ConflictPrefill } from './BookingModal.tsx';

interface SmartAllocatorViewProps {
  stations: LabStation[];
  todayDate: string;
  prefill: ConflictPrefill | null;
  onReserveSuccess: (request: BookingRequest) => void;
}

const DEPARTMENTS: Department[] = ['CS & AI', 'Biotech', 'Aero & Mech', 'Electronics'];

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function SmartAllocatorView({
  stations,
  todayDate,
  prefill,
  onReserveSuccess,
}: SmartAllocatorViewProps) {
  const [stationId, setStationId] = useState(prefill?.stationId ?? 'cs-102');
  const [studentName, setStudentName] = useState(prefill?.studentName ?? 'Ananya Rao');
  const [studentDepartment, setStudentDepartment] = useState<Department>(
    prefill?.studentDepartment ?? 'CS & AI'
  );
  const [projectTitle, setProjectTitle] = useState(
    prefill?.projectTitle ?? 'Multi-Modal Capstone Model Fine-Tuning'
  );
  const [requiredSpecs, setRequiredSpecs] = useState(
    prefill?.requiredSpecs ?? 'RTX 4080, CUDA 12, PyTorch, 32GB+ RAM'
  );
  const [projectDeadline, setProjectDeadline] = useState(
    prefill?.projectDeadline ?? addDays(todayDate, 1)
  );
  const [date, setDate] = useState(prefill?.date ?? todayDate);
  const [startHour, setStartHour] = useState(prefill?.startHour ?? 14);
  const [endHour, setEndHour] = useState(prefill?.endHour ?? 16);
  const [seatsRequested, setSeatsRequested] = useState(prefill?.seatsRequested ?? 2);

  const [loading, setLoading] = useState(false);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    conflictReason: string | null;
    allocation: AiAllocationResponse;
  } | null>(null);

  const runAllocator = async (overrideParams?: {
    stationId: string;
    studentName: string;
    studentDepartment: Department;
    projectTitle: string;
    requiredSpecs: string;
    projectDeadline: string;
    date: string;
    startHour: number;
    endHour: number;
    seatsRequested: number;
  }) => {
    const payload = overrideParams ?? {
      stationId,
      studentName,
      studentDepartment,
      projectTitle,
      requiredSpecs,
      projectDeadline,
      date,
      startHour,
      endHour,
      seatsRequested,
    };

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          bayTrack: 'cross_dept_bay',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Smart Allocator could not complete recommendation.');
        return;
      }

      setResult({
        conflictReason: data.conflict?.hasConflict ? data.conflict.reason : null,
        allocation: data.allocation as AiAllocationResponse,
      });
    } catch {
      setErrorMsg('Network error contacting Gemini Smart Allocator.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefill) {
      setStationId(prefill.stationId);
      setStudentName(prefill.studentName);
      setStudentDepartment(prefill.studentDepartment);
      setProjectTitle(prefill.projectTitle);
      setRequiredSpecs(prefill.requiredSpecs);
      setProjectDeadline(prefill.projectDeadline);
      setDate(prefill.date);
      setStartHour(prefill.startHour);
      setEndHour(prefill.endHour);
      setSeatsRequested(prefill.seatsRequested);
      void runAllocator({
        stationId: prefill.stationId,
        studentName: prefill.studentName,
        studentDepartment: prefill.studentDepartment,
        projectTitle: prefill.projectTitle,
        requiredSpecs: prefill.requiredSpecs,
        projectDeadline: prefill.projectDeadline,
        date: prefill.date,
        startHour: prefill.startHour,
        endHour: prefill.endHour,
        seatsRequested: prefill.seatsRequested,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const applyScenarioPreset = (preset: 'cs_to_bio' | 'cs_to_mech' | 'mech_to_cs') => {
    if (preset === 'cs_to_bio') {
      const next = {
        stationId: 'cs-102',
        studentName: 'Ananya Rao',
        studentDepartment: 'CS & AI' as Department,
        projectTitle: 'Multi-Modal Capstone Model Fine-Tuning',
        requiredSpecs: 'RTX 4080, CUDA 12, PyTorch, Python 3.12',
        projectDeadline: addDays(todayDate, 1),
        date: todayDate,
        startHour: 14,
        endHour: 16,
        seatsRequested: 2,
      };
      setStationId(next.stationId);
      setStudentName(next.studentName);
      setStudentDepartment(next.studentDepartment);
      setProjectTitle(next.projectTitle);
      setRequiredSpecs(next.requiredSpecs);
      setProjectDeadline(next.projectDeadline);
      setDate(next.date);
      setStartHour(next.startHour);
      setEndHour(next.endHour);
      setSeatsRequested(next.seatsRequested);
      void runAllocator(next);
    } else if (preset === 'cs_to_mech') {
      const next = {
        stationId: 'cs-310',
        studentName: 'Siddharth Nair',
        studentDepartment: 'CS & AI' as Department,
        projectTitle: 'Autonomous Delivery Bot Physical Enclosure & CAD',
        requiredSpecs: 'SolidWorks 2025, Fusion 360, Laser Cutter, Assembly Bay',
        projectDeadline: addDays(todayDate, 2),
        date: todayDate,
        startHour: 16,
        endHour: 18,
        seatsRequested: 2,
      };
      setStationId(next.stationId);
      setStudentName(next.studentName);
      setStudentDepartment(next.studentDepartment);
      setProjectTitle(next.projectTitle);
      setRequiredSpecs(next.requiredSpecs);
      setProjectDeadline(next.projectDeadline);
      setDate(next.date);
      setStartHour(next.startHour);
      setEndHour(next.endHour);
      setSeatsRequested(next.seatsRequested);
      void runAllocator(next);
    } else {
      const next = {
        stationId: 'aero-108',
        studentName: 'Tanvi Deshpande',
        studentDepartment: 'Aero & Mech' as Department,
        projectTitle: 'CFD Turbulence Mesh Post-Processing with PyTorch',
        requiredSpecs: 'ANSYS Fluent, MATLAB Simulink, A100 / ROS2 Gazebo',
        projectDeadline: addDays(todayDate, 2),
        date: todayDate,
        startHour: 13,
        endHour: 15,
        seatsRequested: 2,
      };
      setStationId(next.stationId);
      setStudentName(next.studentName);
      setStudentDepartment(next.studentDepartment);
      setProjectTitle(next.projectTitle);
      setRequiredSpecs(next.requiredSpecs);
      setProjectDeadline(next.projectDeadline);
      setDate(next.date);
      setStartHour(next.startHour);
      setEndHour(next.endHour);
      setSeatsRequested(next.seatsRequested);
      void runAllocator(next);
    }
  };

  const handleReserveRecommendation = async (rec: AiRecommendationItem) => {
    setReservingId(rec.candidateId);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: rec.stationId,
          studentName,
          studentDepartment,
          projectTitle,
          requiredSpecs,
          projectDeadline,
          date: rec.date,
          startHour: rec.startHour,
          endHour: rec.endHour,
          bayTrack: rec.bayTrack,
          seatsRequested,
          safetyCleared: true,
          isReallocation: true,
          aiAllocationNote: `${rec.rationale} (${rec.crossDeptBenefit})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not confirm recommended slot.');
        return;
      }
      onReserveSuccess(data.request as BookingRequest);
    } catch {
      setErrorMsg('Network error while reserving recommended slot.');
    } finally {
      setReservingId(null);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="allocator-heading">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl">
          <h1 id="allocator-heading" className="text-2xl sm:text-3xl font-bold text-slate-900">
            GenAI Conflict Resolution & Cross-Department Allocator
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            When primary labs reach peak congestion, Gemini 4 Hydrogen evaluates project deadlines,
            technical specs, and active wet-lab or theory schedules to route students to idle bays across campus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyScenarioPreset('cs_to_bio')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            Preset: CS GPU → Biotech Idle Bay
          </button>
          <button
            type="button"
            onClick={() => applyScenarioPreset('cs_to_mech')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            Preset: CS Hardware → Mech/Aero Bay
          </button>
          <button
            type="button"
            onClick={() => applyScenarioPreset('mech_to_cs')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            Preset: Aero CFD → Robotics Hub
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Parameter Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runAllocator();
          }}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Project Constraints & Target Window
          </h2>

          <div>
            <label htmlFor="alloc-station" className="block text-xs font-semibold text-slate-700 mb-1">
              Preferred (Or Saturated) Station
            </label>
            <select
              id="alloc-station"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="alloc-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Student Name
              </label>
              <input
                id="alloc-name"
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="alloc-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                Home Department
              </label>
              <select
                id="alloc-dept"
                value={studentDepartment}
                onChange={(e) => setStudentDepartment(e.target.value as Department)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="alloc-project" className="block text-xs font-semibold text-slate-700 mb-1">
              Project Title
            </label>
            <input
              id="alloc-project"
              type="text"
              required
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="alloc-specs" className="block text-xs font-semibold text-slate-700 mb-1">
              Required Compute, Software, or Equipment
            </label>
            <input
              id="alloc-specs"
              type="text"
              required
              value={requiredSpecs}
              onChange={(e) => setRequiredSpecs(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="alloc-deadline" className="block text-xs font-semibold text-slate-700 mb-1">
                Project Deadline
              </label>
              <input
                id="alloc-deadline"
                type="date"
                required
                value={projectDeadline}
                onChange={(e) => setProjectDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="alloc-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Target Session Date
              </label>
              <input
                id="alloc-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="alloc-start" className="block text-xs font-semibold text-slate-700 mb-1">
                Start
              </label>
              <select
                id="alloc-start"
                value={startHour}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setStartHour(next);
                  if (endHour <= next) setEndHour(Math.min(21, next + 2));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              >
                {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alloc-end" className="block text-xs font-semibold text-slate-700 mb-1">
                End
              </label>
              <select
                id="alloc-end"
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              >
                {Array.from({ length: 13 }, (_, i) => i + 9)
                  .filter((h) => h > startHour && h <= 21)
                  .map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="alloc-seats" className="block text-xs font-semibold text-slate-700 mb-1">
                Bays
              </label>
              <input
                id="alloc-seats"
                type="number"
                min={1}
                max={8}
                value={seatsRequested}
                onChange={(e) => setSeatsRequested(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? 'Analyzing Campus Schedules…' : 'Find Fair Cross-Dept Allocations'}</span>
          </button>
        </form>

        {/* Right Recommendations Stage */}
        <div className="lg:col-span-7 space-y-4">
          {errorMsg && (
            <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm text-rose-950">
                  <p className="font-semibold">Allocator Error</p>
                  <p className="mt-0.5 text-rose-900">{errorMsg}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void runAllocator()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-900 bg-white border border-rose-300 hover:bg-rose-100 rounded-lg cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading AI recommendations">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-12 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.conflictReason && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm text-amber-950">
                    <p className="font-semibold">Primary Request Conflict</p>
                    <p className="text-amber-900 mt-0.5">{result.conflictReason}</p>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold text-blue-700">Gemini 4 Hydrogen Allocation Summary</p>
                <p className="text-sm text-slate-900 font-medium leading-relaxed">
                  {result.allocation.summary}
                </p>
                <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Fairness Basis:</span>{' '}
                  {result.allocation.fairnessPolicyNote}
                </p>
              </div>

              {result.allocation.recommendations.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    No matching open bays found for this exact seat count
                  </p>
                  <p className="text-xs text-slate-600">
                    Try requesting 1 workstation or adjusting your start hour on the left.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.allocation.recommendations.map((rec, index) => (
                    <article
                      key={rec.candidateId}
                      className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="font-semibold text-blue-700">
                              Option {index + 1}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {rec.stationCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.stationDepartment}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {rec.date} {String(rec.startHour).padStart(2, '0')}:00–
                              {String(rec.endHour).padStart(2, '0')}:00
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 mt-1">
                            {rec.stationName}
                          </h3>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-500">Fairness Score</p>
                          <p className="text-xl font-mono tabular-nums font-bold text-slate-900">
                            {rec.fairnessScore}
                            <span className="text-xs font-normal text-slate-500"> / 100</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <p className="font-semibold text-slate-700">Technical & Deadline Fit</p>
                          <p className="text-slate-600 mt-0.5 leading-relaxed">{rec.rationale}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">Cross-Dept Utilization Gain</p>
                          <p className="text-slate-600 mt-0.5 leading-relaxed">{rec.crossDeptBenefit}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          {rec.autoApproveEligible ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Instant Cross-Dept Clearance
                            </span>
                          ) : (
                            <span>Requires Faculty Approval</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>Note: {rec.tradeOff}</span>
                        </div>

                        <button
                          type="button"
                          disabled={reservingId === rec.candidateId}
                          onClick={() => void handleReserveRecommendation(rec)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>
                            {reservingId === rec.candidateId
                              ? 'Reserving…'
                              : 'Reserve Recommended Slot'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-blue-700 mx-auto" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Ready to Resolve Campus Scheduling Conflicts
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Click a scenario preset above or submit your project constraints on the left to let
                Gemini 4 Hydrogen rank feasible cross-departmental hybrid lab bays.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
