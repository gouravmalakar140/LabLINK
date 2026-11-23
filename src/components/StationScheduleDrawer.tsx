import { useEffect } from 'react';
import { CalendarClock, CheckCircle2, Cpu, Shield, Wrench, X } from 'lucide-react';
import type { BookingRequest, LabStation } from '../types/lablink.ts';

interface StationScheduleDrawerProps {
  station: LabStation | null;
  requests: BookingRequest[];
  todayDate: string;
  onClose: () => void;
  onBookStation: (station: LabStation) => void;
}

export function StationScheduleDrawer({
  station,
  requests,
  todayDate,
  onClose,
  onBookStation,
}: StationScheduleDrawerProps) {
  useEffect(() => {
    if (!station) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [station, onClose]);

  if (!station) return null;

  const todaysBookings = requests.filter(
    (r) =>
      r.stationId === station.id &&
      r.date === todayDate &&
      (r.status === 'approved' || r.status === 'reallocated' || r.status === 'pending_faculty')
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-station-title"
    >
      <div className="bg-white w-full max-w-xl h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono tabular-nums font-semibold text-blue-700">
              {station.code} · {station.department} · {station.building}, {station.room}
            </p>
            <h2 id="drawer-station-title" className="text-xl font-bold text-slate-900 mt-1">
              {station.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close station schedule"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Governance & Safety */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
              <Shield className="w-4 h-4 text-blue-700" aria-hidden="true" />
              Safety Tier: {station.safetyTier}
            </span>
            <span>Faculty Supervisor: {station.facultySupervisor}</span>
          </div>

          {/* Primary vs Shareable Tracks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                Primary Track ({station.primaryTrack.capacity} units)
              </p>
              <p className="text-sm font-semibold text-slate-900">{station.primaryTrack.title}</p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {station.primaryTrack.equipment.map((eq) => (
                  <li key={eq}>{eq}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                Cross-Dept Shareable ({station.shareableTrack.capacity} bays)
              </p>
              <p className="text-sm font-semibold text-slate-900">{station.shareableTrack.title}</p>
              <p className="text-xs text-slate-600">{station.shareableTrack.specs}</p>
              <p className="text-xs text-slate-700 pt-1">
                <span className="font-semibold">Stack:</span>{' '}
                {station.shareableTrack.software.join(' · ')}
              </p>
            </div>
          </div>

          {/* Cross-Department Idle Windows */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-700" aria-hidden="true" />
              Cross-Department Idle Windows
            </h3>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {station.idleWindows.map((win) => (
                <div key={win.id} className="p-3.5 flex items-start justify-between gap-4 bg-white">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{win.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{win.primaryActivity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                      {String(win.startHour).padStart(2, '0')}:00–{String(win.endHour).padStart(2, '0')}:00
                    </p>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      {win.openCrossDeptBays} bays open
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Reservations Today */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Active Reservations ({todayDate})
            </h3>
            {todaysBookings.length === 0 ? (
              <p className="text-sm text-slate-600 p-4 border border-slate-200 rounded-lg bg-slate-50">
                No sessions reserved yet today. All cross-department bays are currently open.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {todaysBookings.map((req) => (
                  <div key={req.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {req.projectTitle}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {req.studentName} · {req.studentDepartment} · {req.seatsRequested} bay(s)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                        {String(req.startHour).padStart(2, '0')}:00–{String(req.endHour).padStart(2, '0')}:00
                      </p>
                      <p className="text-xs text-slate-600 capitalize">
                        {req.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookStation(station);
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
          >
            Book This Station
          </button>
        </div>
      </div>
    </div>
  );
}
