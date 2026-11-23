import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { BookingRequest, RequestStatus } from '../types/lablink.ts';

interface RequestsViewProps {
  requests: BookingRequest[];
  onDecisionApplied: (updated: BookingRequest) => void;
  onNewRequest: () => void;
}

type StatusFilter = 'all' | RequestStatus;

const STATUS_META: Record<
  RequestStatus,
  { label: string; colorClass: string; Icon: typeof CheckCircle2 }
> = {
  approved: {
    label: 'Approved',
    colorClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  reallocated: {
    label: 'Reallocated by AI',
    colorClass: 'text-blue-800 bg-blue-50 border-blue-200',
    Icon: Sparkles,
  },
  pending_faculty: {
    label: 'Pending Faculty Review',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  orientation_required: {
    label: 'Safety Orientation Required',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-200',
    Icon: ShieldAlert,
  },
  rejected: {
    label: 'Declined',
    colorClass: 'text-rose-800 bg-rose-50 border-rose-200',
    Icon: XCircle,
  },
};

export function RequestsView({
  requests,
  onDecisionApplied,
  onNewRequest,
}: RequestsViewProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [simulatorOpen, setSimulatorOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = requests.filter((r) => (filter === 'all' ? true : r.status === filter));

  const applyDecision = async (
    requestId: string,
    decision: 'approve' | 'request_orientation' | 'reject' | 'preempt_for_deadline'
  ) => {
    setBusyId(requestId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not update request status.');
        return;
      }
      onDecisionApplied(data.request as BookingRequest);
    } catch {
      setErrorMsg('Network error updating faculty approval status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="requests-heading">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 id="requests-heading" className="text-2xl sm:text-3xl font-bold text-slate-900">
            Project Access Requests & Faculty Review
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Track cross-departmental lab bookings, AI reallocations, and test faculty clearance workflows interactively.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSimulatorOpen((prev) => !prev)}
            aria-pressed={simulatorOpen}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              simulatorOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {simulatorOpen ? 'Faculty Review Simulator: On' : 'Faculty Review Simulator: Off'}
          </button>
        </div>
      </div>

      {/* Segmented Status Filters */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
        {(
          [
            { id: 'all', label: `All (${requests.length})` },
            {
              id: 'pending_faculty',
              label: `Pending (${requests.filter((r) => r.status === 'pending_faculty').length})`,
            },
            {
              id: 'approved',
              label: `Approved (${requests.filter((r) => r.status === 'approved').length})`,
            },
            {
              id: 'reallocated',
              label: `AI Reallocated (${requests.filter((r) => r.status === 'reallocated').length})`,
            },
            {
              id: 'orientation_required',
              label: `Orientation (${requests.filter((r) => r.status === 'orientation_required').length})`,
            },
          ] as Array<{ id: StatusFilter; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filter === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-sm text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No requests match this filter</p>
          <p className="text-sm text-slate-600">
            Submit a new project-based lab access request to test instant or faculty-reviewed allocation.
          </p>
          <button
            type="button"
            onClick={onNewRequest}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
          >
            Create Access Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const meta = STATUS_META[req.status];
            const StatusIcon = meta.Icon;
            const isCrossDept = req.studentDepartment !== req.stationDepartment;
            const canReview =
              req.status === 'pending_faculty' || req.status === 'orientation_required';

            return (
              <article
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {req.stationCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {req.studentName} ({req.studentDepartment} → {req.stationDepartment})
                      </span>
                      {isCrossDept && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-blue-700">Cross-Dept Session</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">{req.projectTitle}</h2>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-md shrink-0 whitespace-nowrap ${meta.colorClass}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{meta.label}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <p className="text-slate-500">Scheduled Slot</p>
                    <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {req.date} {String(req.startHour).padStart(2, '0')}:00–
                      {String(req.endHour).padStart(2, '0')}:00
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Project Deadline</p>
                    <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {req.projectDeadline}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bays & Track</p>
                    <p className="font-medium text-slate-900 mt-0.5">
                      {req.seatsRequested} bay(s) ·{' '}
                      {req.bayTrack === 'cross_dept_bay' ? 'Shareable Bay' : 'Primary Equipment'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Safety Clearance</p>
                    <p className="font-medium text-slate-900 mt-0.5">
                      {req.safetyCleared ? 'Verified' : 'Orientation Pending'}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                  <p>
                    <span className="font-semibold text-slate-800">Specs:</span> {req.requiredSpecs}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Review Note:</span>{' '}
                    {req.facultyNote}
                  </p>
                  {req.aiAllocationNote && (
                    <p className="text-blue-800">
                      <span className="font-semibold">AI Optimizer Note:</span>{' '}
                      {req.aiAllocationNote}
                    </p>
                  )}
                </div>

                {simulatorOpen && canReview && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600">
                      Simulated Faculty Decision Controls:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void applyDecision(req.id, 'approve')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer"
                      >
                        Approve Access
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void applyDecision(req.id, 'preempt_for_deadline')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
                      >
                        Deadline Priority Approval
                      </button>
                      {req.status === 'pending_faculty' && (
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => void applyDecision(req.id, 'request_orientation')}
                          className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-60 rounded-lg cursor-pointer"
                        >
                          Require Safety Briefing
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void applyDecision(req.id, 'reject')}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-60 rounded-lg cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
