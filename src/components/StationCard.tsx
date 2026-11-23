import { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, AlertTriangle, Cpu, Microscope } from 'lucide-react';
import type { LabStation } from '../types/lablink.ts';

interface StationCardProps {
  station: LabStation;
  bookedSeatsNow: number;
  activeIdleWindowLabel: string | null;
  onBookStation: (station: LabStation) => void;
  onInspectStation: (station: LabStation) => void;
}

export function StationCard({
  station,
  bookedSeatsNow,
  activeIdleWindowLabel,
  onBookStation,
  onInspectStation,
}: StationCardProps) {
  const [imgError, setImgError] = useState(false);

  const totalShareable = station.shareableTrack.capacity;
  const openNow = Math.max(0, totalShareable - bookedSeatsNow);
  const isSaturated = openNow === 0;

  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-colors duration-150 hover:border-slate-300">
      {/* 4:3 Laboratory Photograph with Resilient Fallback */}
      <div className="relative aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
        {!imgError ? (
          <img
            src={station.imageUrl}
            alt={`${station.name} in ${station.building}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200">
            <Microscope className="w-8 h-8 text-slate-500 mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">{station.code}</p>
            <p className="text-xs text-slate-500 mt-1">{station.building}</p>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          {/* Zero-pill unboxed metadata line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {station.code}
            </span>
            <span aria-hidden="true">·</span>
            <span>{station.department}</span>
            <span aria-hidden="true">·</span>
            <span>
              {station.building}, {station.room}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 leading-snug">
            {station.name}
          </h3>

          {/* Explicit non-hue-only status line */}
          <div className="flex items-center gap-2 text-xs font-medium">
            {isSaturated ? (
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Peak Saturated (0 of {totalShareable} open at 14:00)</span>
              </span>
            ) : activeIdleWindowLabel ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Open for Cross-Dept · {openNow}/{totalShareable} bays idle ({activeIdleWindowLabel})
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {openNow}/{totalShareable} shareable bays open
                </span>
              </span>
            )}
          </div>

          {/* Hybrid Split Summary (Whitespace + hairline divider, no nested box cards) */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500">Primary Equipment Track</p>
              <p className="text-slate-800 font-medium truncate" title={station.primaryTrack.title}>
                {station.primaryTrack.title}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                <span>Shareable Cross-Dept Track</span>
              </p>
              <p className="text-slate-900 font-medium">
                {station.shareableTrack.title}{' '}
                <span className="font-mono tabular-nums text-xs text-slate-600">
                  ({station.shareableTrack.capacity} bays)
                </span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5 truncate" title={station.shareableTrack.specs}>
                {station.shareableTrack.specs}
              </p>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onInspectStation(station)}
            className="text-sm font-medium text-slate-700 hover:text-slate-900 py-2 px-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
          >
            View Schedule
          </button>

          <button
            type="button"
            onClick={() => onBookStation(station)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <span>Book Station</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
