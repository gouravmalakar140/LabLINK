import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Microscope,
} from 'lucide-react';
import type { LabStation } from '../types/lablink.ts';
import { formatHour } from '../utils/format.ts';

interface StationCardProps {
  station: LabStation;
  selectedHour: number;
  bookedSeatsNow: number;
  activeIdleWindowLabel: string | null;
  onBookStation: (station: LabStation) => void;
  onInspectStation: (station: LabStation) => void;
}

export function StationCard({
  station,
  selectedHour,
  bookedSeatsNow,
  activeIdleWindowLabel,
  onBookStation,
  onInspectStation,
}: StationCardProps) {
  const [imgError, setImgError] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const totalShareable = station.shareableTrack.capacity;
  const openNow = Math.max(0, totalShareable - bookedSeatsNow);
  const isSaturated = openNow === 0;
  const occupancyPct = Math.min(100, Math.round((bookedSeatsNow / Math.max(1, totalShareable)) * 100));

  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-colors duration-150 hover:border-slate-300">
      {/* Clickable 4:3 Laboratory Photograph */}
      <button
        type="button"
        onClick={() => onInspectStation(station)}
        aria-label={`Inspect schedule for ${station.code} ${station.name}`}
        className="relative aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden block w-full text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700"
      >
        {!imgError ? (
          <img
            src={station.imageUrl}
            alt={`${station.name} in ${station.building}`}
            width={960}
            height={720}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200">
            <Microscope className="w-8 h-8 text-slate-500 mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">{station.code}</p>
            <p className="text-xs text-slate-500 mt-1">{station.building}</p>
          </div>
        )}
      </button>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          {/* Concise unboxed metadata */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {station.code}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{station.department}</span>
            </div>
            <span className="text-slate-500 shrink-0">{station.building}</span>
          </div>

          <h3 className="text-base font-semibold text-slate-900 leading-snug">
            {station.name}
          </h3>

          {/* Live Availability + Micro Capacity Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium">
              {isSaturated ? (
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Full at {formatHour(selectedHour)}</span>
                </span>
              ) : activeIdleWindowLabel ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    {openNow}/{totalShareable} open · Idle Window
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    {openNow}/{totalShareable} bays open
                  </span>
                </span>
              )}
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                {formatHour(selectedHour)}
              </span>
            </div>

            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isSaturated ? 'bg-rose-600' : 'bg-blue-700'
                }`}
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
          </div>

          {/* Concise Shareable Capability */}
          <p className="text-xs text-slate-700 truncate" title={station.shareableTrack.title}>
            <span className="font-semibold text-slate-900">Shareable:</span>{' '}
            {station.shareableTrack.title}
          </p>

          {/* Progressive Disclosure for Full Specs */}
          {detailsOpen && (
            <div className="pt-2.5 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Specs:</span>{' '}
                {station.shareableTrack.specs}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Primary Lab:</span>{' '}
                {station.primaryTrack.title}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Location:</span>{' '}
                {station.building}, {station.room} · {station.safetyTier}
              </p>
            </div>
          )}
        </div>

        {/* Clean Action Row */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onInspectStation(station)}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 py-2 px-1.5 transition-colors cursor-pointer whitespace-nowrap rounded focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              aria-expanded={detailsOpen}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-2 px-1.5 transition-colors cursor-pointer whitespace-nowrap rounded focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <span>{detailsOpen ? 'Less' : 'Specs'}</span>
              {detailsOpen ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onBookStation(station)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <span>{isSaturated ? 'Book / AI' : 'Book'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
