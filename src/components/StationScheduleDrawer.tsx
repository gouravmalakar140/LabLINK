import { useEffect, useMemo } from 'react';
import { CalendarClock, Cpu, Shield, Wrench, X } from 'lucide-react';
import type { BookingRequest, LabStation } from '../types/lablink.ts';
import { formatHour, formatHourRange } from '../utils/format.ts';

interface StationScheduleDrawerProps {
  station: LabStation | null;
  requests: BookingRequest[];
  todayDate: string;
  onClose: () => void;
  onBookStation: (station: LabStation, startHour?: number) => void;
}

const ACTIVE_HOURS = Array.from({ length: 12 }, (_, idx) => idx + 8);

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

  const todaysBookings = useMemo(() => {
    if (!station) return [];
    return requests.filter(
      (r) =>
        r.stationId === station.id &&
        r.date === todayDate &&
        (r.status === 'approved' || r.status === 'reallocated' || r.status === 'pending_faculty')
    );
  }, [station, requests, todayDate]);

  const hourlySlots = useMemo(() => {
    if (!station) return [];
    return ACTIVE_HOURS.map((hour) => {
      const booked = todaysBookings
        .filter((r) => r.bayTrack === 'cross_dept_bay' && r.startHour <= hour && hour < r.endHour)
        .reduce((sum, r) => sum + r.seatsRequested, 0);
      const open = Math.max(0, station.shareableTrack.capacity - booked);
      const hasIdleWin = station.idleWindows.some(
        (w) => w.startHour <= hour && hour < w.endHour
      );
      return { hour, open, hasIdleWin };
    });
  }, [station, todaysBookings]);

  if (!station) return null;

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
          {/* Interactive Hourly Slot Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-700" aria-hidden="true" />
                <span>Tap an Open Hour to Book ({todayDate})</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {station.shareableTrack.capacity} bays max
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {hourlySlots.map((slot) => {
                const isFull = slot.open === 0;
                return (
                  <button
                    key={slot.hour}
                    type="button"
                    onClick={() => {
                      onClose();
                      onBookStation(station, slot.hour);
                    }}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 ${
                      isFull
                        ? 'bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-100'
                        : slot.hasIdleWin
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                        : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    <p className="text-xs font-mono tabular-nums font-semibold">
                      {formatHour(slot.hour)}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums mt-0.5">
                      {isFull ? 'Full' : `${slot.open} open`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Concise Governance Line */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-y border-slate-200 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
              <Shield className="w-4 h-4 text-blue-700" aria-hidden="true" />
              {station.safetyTier}
            </span>
            <span>Supervisor: {station.facultySupervisor}</span>
          </div>

          {/* Primary vs Shareable Tracks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                Primary Equipment ({station.primaryTrack.capacity})
              </p>
              <p className="text-sm font-semibold text-slate-900">{station.primaryTrack.title}</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {station.primaryTrack.equipment.join(' · ')}
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                Shareable Track ({station.shareableTrack.capacity} bays)
              </p>
              <p className="text-sm font-semibold text-slate-900">{station.shareableTrack.title}</p>
              <p className="text-xs text-slate-600">{station.shareableTrack.specs}</p>
              <p className="text-xs text-slate-700 pt-0.5">
                {station.shareableTrack.software.join(' · ')}
              </p>
            </div>
          </div>

          {/* Idle Windows */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Daily Idle Sharing Windows</h3>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {station.idleWindows.map((win) => (
                <div key={win.id} className="p-3 flex items-center justify-between gap-4 bg-white">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{win.label}</p>
                    <p className="text-xs text-slate-600">{win.primaryActivity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                      {formatHourRange(win.startHour, win.endHour)}
                    </p>
                    <p className="text-xs text-emerald-700 font-medium">
                      {win.openCrossDeptBays} bays open
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Reservations */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">
              Booked Today ({todaysBookings.length})
            </h3>
            {todaysBookings.length === 0 ? (
              <p className="text-xs text-slate-600 p-3.5 border border-slate-200 rounded-lg bg-slate-50">
                No reservations yet today. All cross-department bays are open.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {todaysBookings.map((req) => (
                  <div key={req.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {req.projectTitle}
                      </p>
                      <p className="text-xs text-slate-600">
                        {req.studentName} · {req.studentDepartment} · {req.seatsRequested} bay(s)
                      </p>
                    </div>
                    <p className="text-xs font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                      {formatHourRange(req.startHour, req.endHour)}
                    </p>
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
            Book Station
          </button>
        </div>
      </div>
    </div>
  );
}
