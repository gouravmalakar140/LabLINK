import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type {
  BookingRequest,
  CampusUtilizationSummary,
  Department,
  LabStation,
  ResourceCategory,
} from './types/lablink.ts';
import { TopBar, type NavView } from './components/TopBar.tsx';
import { StationCard } from './components/StationCard.tsx';
import { BookingModal, type ConflictPrefill } from './components/BookingModal.tsx';
import { StationScheduleDrawer } from './components/StationScheduleDrawer.tsx';
import { SmartAllocatorView } from './components/SmartAllocatorView.tsx';
import { RequestsView } from './components/RequestsView.tsx';
import { UtilizationView } from './components/UtilizationView.tsx';

type DeptFilter = 'All' | Department;
type CategoryFilter = 'All' | ResourceCategory;

const DEPARTMENTS: DeptFilter[] = ['All', 'Biotech', 'Aero & Mech', 'CS & AI', 'Electronics'];
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
  const [inspectStation, setInspectStation] = useState<LabStation | null>(null);
  const [allocatorPrefill, setAllocatorPrefill] = useState<ConflictPrefill | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = window.setTimeout(() => setToastMsg(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const fetchCampusData = useCallback(async (hour = selectedHour) => {
    setLoading(true);
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

  const handleBookingSuccess = (created: BookingRequest) => {
    setBookingModalOpen(false);
    setRequests((prev) => [created, ...prev]);
    void fetchCampusData(selectedHour);
    showToast(
      created.status === 'approved' || created.status === 'reallocated'
        ? `Confirmed: ${created.stationCode} (${String(created.startHour).padStart(2, '0')}:00–${String(created.endHour).padStart(2, '0')}:00)`
        : `Submitted to ${created.stationCode} faculty review queue.`
    );
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
    showToast(`Updated ${updated.stationCode} request status to ${updated.status.replace('_', ' ')}.`);
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
      showToast('Campus schedule and sample requests restored to initial state.');
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
        onNavigate={setActiveView}
        onNewRequest={() => {
          setBookingStation(stations[0] ?? null);
          setBookingModalOpen(true);
        }}
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

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
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
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeView === 'discover' && (
              <div className="space-y-8">
                {/* Concise Hero Header */}
                <section className="space-y-6 pb-6 border-b border-slate-200">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="max-w-2xl space-y-2.5">
                      <p className="text-xs font-semibold text-blue-700">
                        Cross-Department Hybrid Laboratory Network
                      </p>
                      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                        Unlock Idle Lab Equipment and Workstations Across Every Department
                      </h1>
                      <p className="text-base text-slate-600 leading-relaxed">
                        Discover shareable GPU workstations inside Biotech wet-labs, CAD and wind-tunnel bays in Aerospace, and mechatronics benches in Robotics—with Gemini AI conflict resolution based on your project deadline.
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
                        <span>Launch Smart Allocator</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingStation(stations[0] ?? null);
                          setBookingModalOpen(true);
                        }}
                        className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Book a Lab Station
                      </button>
                    </div>
                  </div>

                  {/* Full-width 4-KPI Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-500">Active Hybrid Stations</p>
                      <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                        {loading ? '—' : utilization?.activeHybridStations ?? 0}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">Across 4 departments</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Idle Cross-Dept Bays Now ({String(selectedHour).padStart(2, '0')}:00)
                      </p>
                      <p className="text-2xl font-mono tabular-nums font-bold text-emerald-700 mt-1">
                        {loading ? '—' : utilization?.idleBaysOpenNow ?? 0}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Of {utilization?.totalShareableBays ?? 0} shareable seats
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-500">Shared Hours Unlocked</p>
                      <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                        {loading ? '—' : `${utilization?.sharedHoursUnlockedWeekly ?? 0} hrs`}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">Weekly during core classes</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-500">Pending Faculty Reviews</p>
                      <p className="text-2xl font-mono tabular-nums font-bold text-amber-700 mt-1">
                        {loading ? '—' : utilization?.pendingFacultyReviews ?? 0}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {utilization?.conflictResolutionRatePct ?? 100}% fulfillment rate
                      </p>
                    </div>
                  </div>
                </section>

                {/* Search & Segmented Filters */}
                <section className="space-y-4" aria-label="Filter laboratory stations">
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
                        placeholder="Search equipment, software (CUDA, SolidWorks, PCR)…"
                        className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyOpenCrossDept}
                        onChange={(e) => setOnlyOpenCrossDept(e.target.checked)}
                        className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                      />
                      <span>Only stations with idle cross-dept bays now</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Department Segmented Control */}
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
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

                    {/* Capability Segmented Control */}
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            categoryFilter === cat
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Hybrid Lab Station Grid */}
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                      >
                        <div className="aspect-[4/3] bg-slate-200" />
                        <div className="p-5 space-y-3">
                          <div className="h-3 w-36 bg-slate-200 rounded" />
                          <div className="h-5 w-4/5 bg-slate-200 rounded" />
                          <div className="h-12 w-full bg-slate-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                    <p className="text-base font-semibold text-slate-900">
                      No hybrid lab stations match your current filters
                    </p>
                    <p className="text-sm text-slate-600">
                      Clear your search query or switch departments to inspect cross-departmental bays.
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStations.map((station) => {
                      const occ = occupancyByStationId.get(station.id);
                      return (
                        <StationCard
                          key={station.id}
                          station={station}
                          bookedSeatsNow={occ?.bookedSeatsToday ?? 0}
                          activeIdleWindowLabel={occ?.activeIdleWindowLabel ?? null}
                          onBookStation={(st) => {
                            setBookingStation(st);
                            setBookingModalOpen(true);
                          }}
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
                onDecisionApplied={handleDecisionApplied}
                onNewRequest={() => {
                  setBookingStation(stations[0] ?? null);
                  setBookingModalOpen(true);
                }}
              />
            )}

            {activeView === 'utilization' && utilization && (
              <UtilizationView
                utilization={utilization}
                stations={stations}
                selectedHour={selectedHour}
                onHourChange={setSelectedHour}
                onBookStation={(st) => {
                  setBookingStation(st);
                  setBookingModalOpen(true);
                }}
                onResetDemo={handleResetDemo}
                resetting={resetting}
              />
            )}
          </motion.div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>LabLink · Cross-Departmental Campus Laboratory Resource Sharing</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveView('allocator')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Conflict Resolver
            </button>
            <button
              type="button"
              onClick={() => setActiveView('utilization')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Campus Utilization
            </button>
          </div>
        </div>
      </footer>

      <BookingModal
        isOpen={bookingModalOpen}
        stations={stations}
        initialStation={bookingStation}
        todayDate={todayDate}
        onClose={() => setBookingModalOpen(false)}
        onSuccess={handleBookingSuccess}
        onResolveWithAi={handleResolveWithAi}
      />

      <StationScheduleDrawer
        station={inspectStation}
        requests={requests}
        todayDate={todayDate}
        onClose={() => setInspectStation(null)}
        onBookStation={(st) => {
          setBookingStation(st);
          setBookingModalOpen(true);
        }}
      />
    </div>
  );
}
