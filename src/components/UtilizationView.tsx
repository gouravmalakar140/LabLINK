import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Cpu, RotateCcw, Wrench } from 'lucide-react';
import type { CampusUtilizationSummary, LabStation } from '../types/lablink.ts';

interface UtilizationViewProps {
  utilization: CampusUtilizationSummary;
  stations: LabStation[];
  selectedHour: number;
  onHourChange: (hour: number) => void;
  onBookStation: (station: LabStation) => void;
  onResetDemo: () => void;
  resetting: boolean;
}

export function UtilizationView({
  utilization,
  stations,
  selectedHour,
  onHourChange,
  onBookStation,
  onResetDemo,
  resetting,
}: UtilizationViewProps) {
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

  const toggleExpand = (stationId: string) => {
    setExpandedStationId((prev) => (prev === stationId ? null : stationId));
  };

  return (
    <section className="space-y-6" aria-labelledby="utilization-heading">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl">
          <h1 id="utilization-heading" className="text-2xl sm:text-3xl font-bold text-slate-900">
            Cross-Department Utilization & Idle Capacity Matrix
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Quantifying how routing students into idle wet-lab compute bays and off-peak fabrication stations relieves departmental bottlenecks.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDemo}
          disabled={resetting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap shrink-0 w-fit"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{resetting ? 'Resetting…' : 'Reset Demo Data'}</span>
        </button>
      </div>

      {/* Department-by-Department Siloed vs Hybrid Gains */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Siloed Baseline vs. Hybrid Sharing Utilization
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Biotech, Aero/Mech, and Electronics unlock idle workstation hours while relieving CS annex congestion.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" aria-hidden="true" />
              Siloed Baseline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-700 inline-block" aria-hidden="true" />
              With LabLink Hybrid Sharing
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {utilization.departmentMetrics.map((dept) => (
            <div
              key={dept.department}
              className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50/60"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{dept.department}</h3>
                <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700">
                  +{dept.sharedHoursUnlocked} hrs/wk shared
                </span>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Siloed Single-Dept Usage</span>
                    <span className="font-mono tabular-nums font-medium">
                      {dept.siloedUtilizationPct}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${dept.siloedUtilizationPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-800 font-medium">
                    <span>LabLink Hybrid Utilization</span>
                    <span className="font-mono tabular-nums font-semibold text-blue-700">
                      {dept.hybridUtilizationPct}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 rounded-full"
                      style={{ width: `${dept.hybridUtilizationPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Cross-dept sessions hosted:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {dept.crossDeptHostedSessions}
                  </strong>
                </span>
                <span>
                  Peak relief:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {dept.bottleneckReliefPct}%
                  </strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Hour-by-Hour Station Occupancy Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Station Occupancy Inspector
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Scrub campus hours to inspect active wet-lab/theory idle windows and cross-department bay openings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="hour-inspector" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Campus Hour:
            </label>
            <select
              id="hour-inspector"
              value={selectedHour}
              onChange={(e) => onHourChange(Number(e.target.value))}
              className="min-h-[44px] sm:min-h-0 px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00 – {String(h + 1).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile-Only Inspector Layout (Android 13-16 & iOS optimized) */}
        <div className="md:hidden divide-y divide-slate-200">
          {utilization.stationOccupancy.map((row) => {
            const station = stations.find((s) => s.id === row.stationId);
            const isExpanded = expandedStationId === row.stationId;
            const activeWindow = station?.idleWindows.find(
              (w) => w.startHour <= selectedHour && selectedHour < w.endHour
            );

            return (
              <div key={row.stationId} className="bg-white">
                {/* Main Row: Only Station Code + Department Name on left, Occupancy + 'More' button beside it */}
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                      {row.code}
                    </p>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {row.department}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className={`font-mono tabular-nums text-sm font-bold ${
                          row.crossDeptIdleNow === 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {row.crossDeptIdleNow} open
                      </p>
                      <p className="font-mono tabular-nums text-[11px] text-slate-500">
                        {row.bookedSeatsToday}/{row.totalCrossDeptSeats} booked
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(row.stationId)}
                      aria-expanded={isExpanded}
                      aria-controls={`mobile-station-more-${row.stationId}`}
                      className={`min-h-[44px] px-3.5 inline-flex items-center gap-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700 ${
                        isExpanded
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>More</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Specialization & Booking Panel */}
                {isExpanded && station && (
                  <div
                    id={`mobile-station-more-${row.stationId}`}
                    className="px-4 pb-4 pt-3 bg-slate-50 border-t border-slate-200 space-y-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{station.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {station.building}, {station.room} · {station.safetyTier}
                      </p>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                          <span>Primary Specialization ({station.primaryTrack.title})</span>
                        </p>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                          {station.primaryTrack.equipment.join(' · ')}
                        </p>
                      </div>

                      <div>
                        <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                          <span>Shareable Cross-Dept Bays ({station.shareableTrack.title})</span>
                        </p>
                        <p className="text-slate-700 mt-0.5">{station.shareableTrack.specs}</p>
                        <p className="text-slate-600 mt-0.5">
                          Tools: {station.shareableTrack.software.join(', ')}
                        </p>
                      </div>

                      {activeWindow ? (
                        <p className="text-emerald-800 font-medium pt-1">
                          Active at {String(selectedHour).padStart(2, '0')}:00: {activeWindow.primaryActivity}
                        </p>
                      ) : (
                        <p className="text-slate-600 pt-1">
                          Standard cross-department schedule at {String(selectedHour).padStart(2, '0')}:00.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onBookStation(station)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>Book {station.code}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table Layout (unchanged for >= md viewports) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Station</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Active Idle Window</th>
                <th className="py-3 px-4 text-right">Booked</th>
                <th className="py-3 px-4 text-right">Idle Bays Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {utilization.stationOccupancy.map((row) => (
                <tr key={row.stationId} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <span className="font-mono tabular-nums font-semibold text-slate-900 mr-2">
                      {row.code}
                    </span>
                    <span className="text-slate-700">{row.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{row.department}</td>
                  <td className="py-3 px-4 text-xs">
                    {row.activeIdleWindowLabel ? (
                      <span className="font-medium text-emerald-700">
                        {row.activeIdleWindowLabel}
                      </span>
                    ) : (
                      <span className="text-slate-500">Standard schedule</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                    {row.bookedSeatsToday} / {row.totalCrossDeptSeats}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    <span className={row.crossDeptIdleNow === 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {row.crossDeptIdleNow}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
