import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type {
  BookingRequest,
  CampusUtilizationSummary,
  Department,
  LabStation,
  RequestStatus,
  ResourceCategory,
} from './types/lablink.ts';
import { TopBar, type NavView } from './components/TopBar.tsx';
import { StationCard } from './components/StationCard.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import type { ConflictPrefill } from './components/BookingModal.tsx';
import { DEPARTMENTS as BASE_DEPARTMENTS, formatHour, formatHourRange } from './utils/format.ts';

const BookingModal = lazy(() =>
  import('./components/BookingModal.tsx').then((m) => ({ default: m.BookingModal }))
);
const StationScheduleDrawer = lazy(() =>
  import('./components/StationScheduleDrawer.tsx').then((m) => ({
    default: m.StationScheduleDrawer,
  }))
);
const SmartAllocatorView = lazy(() =>
  import('./components/SmartAllocatorView.tsx').then((m) => ({ default: m.SmartAllocatorView }))
);
const RequestsView = lazy(() =>
  import('./components/RequestsView.tsx').then((m) => ({ default: m.RequestsView }))
);
const UtilizationView = lazy(() =>
  import('./components/UtilizationView.tsx').then((m) => ({ default: m.UtilizationView }))
);

type DeptFilter = 'All' | Department;
type CategoryFilter = 'All' | ResourceCategory;

const DEPARTMENTS: DeptFilter[] = ['All', ...BASE_DEPARTMENTS];
const CATEGORIES: CategoryFilter[] = [
  'All',
  'Compute & GPU',
  'Fabrication & CNC',
  'Wet & Bio Lab',
  'Hardware & IoT',
];

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('discover');
  const [stations, setStations] = useState<LabStation[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [utilization, setUtilization] = useState<CampusUtilizationSummary | null>(null);
  const [todayDate, setTodayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedHour, setSelectedHour] = useState<number>(14);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Discover filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [onlyOpenCrossDept, setOnlyOpenCrossDept] = useState(false);

  // Modals & Drawers
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingStation, setBookingStation] = useState<LabStation | null>(null);
  const [bookingStartHour, setBookingStartHour] = useState<number | undefined>(undefined);
  const [inspectStation, setInspectStation] = useState<LabStation | null>(null);
  const [allocatorPrefill, setAllocatorPrefill] = useState<ConflictPrefill | null>(null);
  const [requestsInitialFilter, setRequestsInitialFilter] = useState<'all' | RequestStatus>('all');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const hasHydratedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = window.setTimeout(() => setToastMsg(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const fetchCampusData = useCallback(async (hour = selectedHour) => {
    if (!hasHydratedRef.current) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await fetch(`/api/labs?hour=${hour}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load campus lab inventory.');
      }
      setStations(data.stations as LabStation[]);
      setRequests(data.requests as BookingRequest[]);
      setUtilization(data.utilization as CampusUtilizationSummary);
      if (data.today) setTodayDate(data.today as string);
      hasHydratedRef.current = true;
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to reach LabLink server.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedHour]);

  useEffect(() => {
    void fetchCampusData(selectedHour);
  }, [fetchCampusData, selectedHour]);

  const occupancyByStationId = useMemo(() => {
    const map = new Map<
      string,
      { bookedSeatsToday: number; crossDeptIdleNow: number; activeIdleWindowLabel: string | null }
    >();
    for (const row of utilization?.stationOccupancy ?? []) {
      map.set(row.stationId, {
        bookedSeatsToday: row.bookedSeatsToday,
        crossDeptIdleNow: row.crossDeptIdleNow,
        activeIdleWindowLabel: row.activeIdleWindowLabel,
      });
    }
    return map;
  }, [utilization]);

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stations.filter((st) => {
      if (deptFilter !== 'All' && st.department !== deptFilter) return false;
      if (categoryFilter !== 'All' && st.category !== categoryFilter) return false;

      if (onlyOpenCrossDept) {
        const occ = occupancyByStationId.get(st.id);
        if (!occ || occ.crossDeptIdleNow <= 0) return false;
      }

      if (!q) return true;
      const haystack = [
        st.code,
        st.name,
        st.department,
        st.building,
        st.category,
        st.primaryTrack.title,
        ...st.primaryTrack.equipment,
        st.shareableTrack.title,
        st.shareableTrack.specs,
        ...st.shareableTrack.software,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [stations, deptFilter, categoryFilter, onlyOpenCrossDept, searchQuery, occupancyByStationId]);

  const openBooking = (station: LabStation | null, hour?: number) => {
    setBookingStation(station ?? stations[0] ?? null);
    setBookingStartHour(hour ?? selectedHour);
    setBookingModalOpen(true);
  };

  const handleBookingSuccess = (created: BookingRequest) => {
    setBookingModalOpen(false);
    setRequests((prev) => [created, ...prev]);
    void fetchCampusData(selectedHour);
    showToast(
      created.status === 'approved' || created.status === 'reallocated'
        ? `Confirmed: ${created.stationCode} (${formatHourRange(created.startHour, created.endHour)})`
        : `Submitted to ${created.stationCode} faculty review.`
    );
    setRequestsInitialFilter('all');
    setActiveView('requests');
  };

  const handleResolveWithAi = (prefill: ConflictPrefill) => {
    setBookingModalOpen(false);
    setAllocatorPrefill(prefill);
    setActiveView('allocator');
  };

  const handleDecisionApplied = (updated: BookingRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    void fetchCampusData(selectedHour);
    showToast(`Updated ${updated.stationCode} status to ${updated.status.replace('_', ' ')}.`);
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed.');
      setStations(data.stations as LabStation[]);
      setRequests(data.requests as BookingRequest[]);
      setUtilization(data.utilization as CampusUtilizationSummary);
      showToast('Campus schedule restored to initial state.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reset demo state.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      <TopBar
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'requests') setRequestsInitialFilter('all');
          setActiveView(view);
        }}
        onNewRequest={() => openBooking(stations[0] ?? null)}
      />

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="flex-1">{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-7">
        {loadError ? (
          <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3 max-w-lg mx-auto my-12">
            <AlertCircle className="w-8 h-8 text-rose-700 mx-auto" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-slate-900">Unable to Load LabLink</h1>
            <p className="text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void fetchCampusData(selectedHour)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-600 animate-pulse">
                  Loading workspace view…
                </div>
              }
            >
              <div key={activeView} className="transition-opacity duration-150">
                {activeView === 'discover' && (
                  <div className="space-y-6">
                    {/* Concise Hero + Interactive Quick-Action Stats */}
                    <section className="space-y-5 pb-5 border-b border-slate-200">
                      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                        <div className="max-w-xl space-y-1.5">
                          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                            Find Open Lab Bays Across Every Department
                          </h1>
                          <p className="text-sm sm:text-base text-slate-600">
                            Book idle workstations across campus or let AI resolve time conflicts.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAllocatorPrefill(null);
                              setActiveView('allocator');
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Sparkles className="w-4 h-4 text-blue-700" aria-hidden="true" />
                            <span>Smart Allocator</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openBooking(stations[0] ?? null)}
                            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Book a Lab
                          </button>
                        </div>
                      </div>

                      {/* Interactive 4-KPI Strip */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <p className="text-xs font-medium text-slate-500">Hybrid Labs</p>
                          <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                            {loading ? '—' : utilization?.activeHybridStations ?? 0}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOnlyOpenCrossDept((prev) => !prev)}
                          aria-pressed={onlyOpenCrossDept}
                          className={`text-left rounded-xl p-4 border transition-colors cursor-pointer ${
                            onlyOpenCrossDept
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className="text-xs font-medium text-slate-600">
                            Open at {formatHour(selectedHour)}
                          </p>
                          <p className="text-2xl font-mono tabular-nums font-bold text-emerald-700 mt-1">
                            {loading ? '—' : `${utilization?.idleBaysOpenNow ?? 0} bays`}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveView('utilization')}
                          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-medium text-slate-500">Weekly Shared</p>
                          <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                            {loading ? '—' : `${utilization?.sharedHoursUnlockedWeekly ?? 0} hrs`}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRequestsInitialFilter('pending_faculty');
                            setActiveView('requests');
                          }}
                          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-medium text-slate-500">Pending Review</p>
                          <p className="text-2xl font-mono tabular-nums font-bold text-amber-700 mt-1">
                            {loading ? '—' : utilization?.pendingFacultyReviews ?? 0}
                          </p>
                        </button>
                      </div>
                    </section>

                    {/* Streamlined Search & Interactive Controls */}
                    <section className="space-y-3" aria-label="Filter laboratory stations">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search
                            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search stations by equipment, software, or building"
                            placeholder="Search CUDA, SolidWorks, PCR, room…"
                            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5">
                            <label htmlFor="discover-hour" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                              Time:
                            </label>
                            <select
                              id="discover-hour"
                              value={selectedHour}
                              onChange={(e) => setSelectedHour(Number(e.target.value))}
                              className="px-2.5 py-1.5 text-xs font-mono tabular-nums font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                            >
                              {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
                                <option key={h} value={h}>
                                  {formatHour(h)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label htmlFor="discover-category" className="sr-only">
                              Equipment Category
                            </label>
                            <select
                              id="discover-category"
                              value={categoryFilter}
                              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat === 'All' ? 'All Equipment' : cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setOnlyOpenCrossDept((prev) => !prev)}
                            aria-pressed={onlyOpenCrossDept}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              onlyOpenCrossDept
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Open Now Only
                          </button>
                        </div>
                      </div>

                      {/* Department Segmented Tabs */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                        {DEPARTMENTS.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setDeptFilter(dept)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                              deptFilter === dept
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Hybrid Lab Station Grid */}
                    {loading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                          >
                            <div className="aspect-[4/3] bg-slate-200" />
                            <div className="p-5 space-y-3">
                              <div className="h-3 w-36 bg-slate-200 rounded" />
                              <div className="h-5 w-4/5 bg-slate-200 rounded" />
                              <div className="h-10 w-full bg-slate-100 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredStations.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                        <p className="text-base font-semibold text-slate-900">
                          No lab stations match these filters
                        </p>
                        <p className="text-sm text-slate-600">
                          Try clearing your search or switching departments.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setDeptFilter('All');
                            setCategoryFilter('All');
                            setOnlyOpenCrossDept(false);
                          }}
                          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredStations.map((station) => {
                          const occ = occupancyByStationId.get(station.id);
                          return (
                            <StationCard
                              key={station.id}
                              station={station}
                              selectedHour={selectedHour}
                              bookedSeatsNow={occ?.bookedSeatsToday ?? 0}
                              activeIdleWindowLabel={occ?.activeIdleWindowLabel ?? null}
                              onBookStation={(st) => openBooking(st)}
                              onInspectStation={(st) => setInspectStation(st)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeView === 'allocator' && (
                  <SmartAllocatorView
                    stations={stations}
                    todayDate={todayDate}
                    prefill={allocatorPrefill}
                    onReserveSuccess={handleBookingSuccess}
                  />
                )}

                {activeView === 'requests' && (
                  <RequestsView
                    requests={requests}
                    initialFilter={requestsInitialFilter}
                    onDecisionApplied={handleDecisionApplied}
                    onNewRequest={() => openBooking(stations[0] ?? null)}
                  />
                )}

                {activeView === 'utilization' && utilization && (
                  <UtilizationView
                    utilization={utilization}
                    stations={stations}
                    selectedHour={selectedHour}
                    onHourChange={setSelectedHour}
                    onBookStation={(st) => openBooking(st)}
                    onResetDemo={handleResetDemo}
                    resetting={resetting}
                  />
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>LabLink · Campus Laboratory Sharing</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveView('allocator')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Smart Allocator
            </button>
            <button
              type="button"
              onClick={() => setActiveView('utilization')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Utilization
            </button>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        {bookingModalOpen && (
          <BookingModal
            isOpen={bookingModalOpen}
            stations={stations}
            initialStation={bookingStation}
            initialStartHour={bookingStartHour}
            todayDate={todayDate}
            onClose={() => setBookingModalOpen(false)}
            onSuccess={handleBookingSuccess}
            onResolveWithAi={handleResolveWithAi}
          />
        )}

        {inspectStation && (
          <StationScheduleDrawer
            station={inspectStation}
            requests={requests}
            todayDate={todayDate}
            onClose={() => setInspectStation(null)}
            onBookStation={(st, hour) => openBooking(st, hour)}
          />
        )}
      </Suspense>
    </div>
  );
}
