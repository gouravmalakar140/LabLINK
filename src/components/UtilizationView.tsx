import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Cpu, RotateCcw, Wrench } from 'lucide-react';
import type { CampusUtilizationSummary, Department, LabStation } from '../types/lablink.ts';
import { formatHour, formatHourRange } from '../utils/format.ts';

interface UtilizationViewProps {
  utilization: CampusUtilizationSummary;
  stations: LabStation[];
  selectedHour: number;
  onHourChange: (hour: number) => void;
  onBookStation: (station: LabStation) => void;
  onResetDemo: () => void;
  resetting: boolean;
}

const QUICK_HOURS = [
  { hour: 10, label: '10:00' },
  { hour: 14, label: '14:00 Peak' },
  { hour: 16, label: '16:00' },
  { hour: 18, label: '18:00' },
];

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
  const [metricMode, setMetricMode] = useState<'pct' | 'hours'>('pct');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<Department | null>(null);

  const stationById = useMemo(() => {
    const map = new Map<string, LabStation>();
    for (const s of stations) {
      map.set(s.id, s);
    }
    return map;
  }, [stations]);

  const visibleOccupancy = useMemo(() => {
    if (!selectedDeptFilter) return utilization.stationOccupancy;
    return utilization.stationOccupancy.filter((row) => row.department === selectedDeptFilter);
  }, [utilization.stationOccupancy, selectedDeptFilter]);

  const maxHours = useMemo(() => {
    return Math.max(
      1,
      ...utilization.departmentMetrics.map((d) => d.sharedHoursUnlocked)
    );
  }, [utilization.departmentMetrics]);

  const toggleExpand = (stationId: string) => {
    setExpandedStationId((prev) => (prev === stationId ? null : stationId));
  };

  return (
    <section className="space-y-6" aria-labelledby="utilization-heading">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 id="utilization-heading" className="text-2xl sm:text-3xl font-bold text-slate-900">
            Campus Lab Utilization
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tap a department to filter labs, or scrub hours to see open bays live.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDemo}
          disabled={resetting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap shrink-0 w-fit"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{resetting ? 'Resetting…' : 'Reset Demo'}</span>
        </button>
      </div>

      {/* Interactive Department Gain Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Department Sharing Impact
            </h2>
            <p className="text-xs text-slate-600">
              {selectedDeptFilter
                ? `Filtered to ${selectedDeptFilter} below — click again to show all.`
                : 'Click any department row to filter the station inspector below.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMetricMode('pct')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                metricMode === 'pct'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Utilization %
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('hours')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                metricMode === 'hours'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hours Unlocked
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {utilization.departmentMetrics.map((dept) => {
            const isSelected = selectedDeptFilter === dept.department;
            const gainPct = Math.max(0, dept.hybridUtilizationPct - dept.siloedUtilizationPct);

            return (
              <button
                key={dept.department}
                type="button"
                onClick={() =>
                  setSelectedDeptFilter((prev) =>
                    prev === dept.department ? null : dept.department
                  )
                }
                aria-pressed={isSelected}
                className={`w-full text-left py-3 px-3 -mx-3 rounded-lg transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
                  isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="sm:w-36 shrink-0 flex items-center justify-between sm:block">
                  <span className="text-sm font-semibold text-slate-900">{dept.department}</span>
                  <span className="sm:hidden font-mono tabular-nums text-xs font-semibold text-blue-700">
                    {metricMode === 'pct'
                      ? `${dept.siloedUtilizationPct}% → ${dept.hybridUtilizationPct}%`
                      : `+${dept.sharedHoursUnlocked} hrs/wk`}
                  </span>
                </div>

                <div className="flex-1">
                  {metricMode === 'pct' ? (
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex" aria-hidden="true">
                      <div
                        className="h-full bg-slate-300 transition-all duration-200"
                        style={{ width: `${dept.siloedUtilizationPct}%` }}
                        title={`Siloed: ${dept.siloedUtilizationPct}%`}
                      />
                      <div
                        className="h-full bg-blue-700 transition-all duration-200"
                        style={{ width: `${gainPct}%` }}
                        title={`LabLink Hybrid: ${dept.hybridUtilizationPct}%`}
                      />
                    </div>
                  ) : (
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-200"
                        style={{ width: `${Math.round((dept.sharedHoursUnlocked / maxHours) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="hidden sm:block sm:w-36 text-right font-mono tabular-nums text-xs font-semibold shrink-0">
                  {metricMode === 'pct' ? (
                    <span>
                      <span className="text-slate-500">{dept.siloedUtilizationPct}%</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="text-blue-700">{dept.hybridUtilizationPct}%</span>
                    </span>
                  ) : (
                    <span className="text-emerald-700">+{dept.sharedHoursUnlocked} hrs/wk</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {metricMode === 'pct' && (
          <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" aria-hidden="true" />
              Siloed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block" aria-hidden="true" />
              With LabLink
            </span>
          </div>
        )}
      </div>

      {/* Live Hour-by-Hour Station Occupancy Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Station Occupancy Inspector
            </h2>
            {selectedDeptFilter && (
              <button
                type="button"
                onClick={() => setSelectedDeptFilter(null)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
              >
                Clear {selectedDeptFilter} filter
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {QUICK_HOURS.map((item) => (
                <button
                  key={item.hour}
                  type="button"
                  onClick={() => onHourChange(item.hour)}
                  className={`px-2.5 py-1 text-xs font-mono tabular-nums font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    selectedHour === item.hour
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="hour-inspector" className="sr-only">
                Campus Hour
              </label>
              <select
                id="hour-inspector"
                value={selectedHour}
                onChange={(e) => onHourChange(Number(e.target.value))}
                className="min-h-[44px] sm:min-h-0 px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    {formatHourRange(h, h + 1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mobile-Only Inspector Layout (Android 13-16 & iOS optimized: Station Code + Department Name + More button) */}
        <div className="md:hidden divide-y divide-slate-200">
          {visibleOccupancy.map((row) => {
            const station = stationById.get(row.stationId);
            const isExpanded = expandedStationId === row.stationId;
            const activeWindow = station?.idleWindows.find(
              (w) => w.startHour <= selectedHour && selectedHour < w.endHour
            );

            return (
              <div key={row.stationId} className="bg-white">
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

                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                          <span>Primary: {station.primaryTrack.title}</span>
                        </p>
                        <p className="text-slate-600 mt-0.5">
                          {station.primaryTrack.equipment.join(' · ')}
                        </p>
                      </div>

                      <div>
                        <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                          <span>Shareable: {station.shareableTrack.title}</span>
                        </p>
                        <p className="text-slate-700 mt-0.5">{station.shareableTrack.specs}</p>
                      </div>

                      {activeWindow && (
                        <p className="text-emerald-800 font-medium">
                          {formatHour(selectedHour)}: {activeWindow.primaryActivity}
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

        {/* Desktop Interactive Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Station</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Window</th>
                <th className="py-3 px-4 text-right">Booked</th>
                <th className="py-3 px-4 text-right">Open</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {visibleOccupancy.map((row) => {
                const station = stationById.get(row.stationId);
                return (
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
                        <span className="text-slate-500">Standard</span>
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
                    <td className="py-3 px-4 text-right">
                      {station && (
                        <button
                          type="button"
                          onClick={() => onBookStation(station)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {row.crossDeptIdleNow === 0 ? 'Resolve AI' : 'Book'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
