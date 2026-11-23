import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { BookingRequest, ConflictDetail, Department, RequestStatus } from '../src/types/lablink.ts';
import { DEPARTMENTS } from '../src/utils/format.ts';
import {
  checkSlotConflict,
  computeUtilizationSummary,
  generateCandidateAllocations,
  validateBookingInput,
} from './allocator.ts';
import { GeminiServiceError, generateFairAllocationRecommendations } from './gemini.ts';
import { createRateLimiter, isPlainObject, sanitizeText } from './middleware.ts';
import { formatLocalIsoDate } from './seed.ts';
import { mutateStore, readStore, resetStore } from './store.ts';

const VALID_REQUEST_ID_RE = /^req-[a-z0-9-]+$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_DECISIONS = new Set([
  'approve',
  'request_orientation',
  'reject',
  'preempt_for_deadline',
]);

export function createApiRouter(): Router {
  const router = Router();

  const mutationLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
  });

  const aiLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
  });

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/labs', async (req, res) => {
    try {
      const store = await readStore();
      const today =
        typeof req.query.date === 'string' && ISO_DATE_RE.test(req.query.date)
          ? req.query.date
          : formatLocalIsoDate();
      const hourParam = Number(req.query.hour);
      const currentHour =
        Number.isInteger(hourParam) && hourParam >= 8 && hourParam <= 20 ? hourParam : 14;

      const utilization = computeUtilizationSummary(
        store.stations,
        store.requests,
        today,
        currentHour
      );

      res.json({
        stations: store.stations,
        requests: store.requests,
        utilization,
        today,
      });
    } catch {
      res.status(500).json({ error: 'Unable to load laboratory inventory.' });
    }
  });

  router.get('/requests', async (_req, res) => {
    try {
      const store = await readStore();
      res.json({ requests: store.requests });
    } catch {
      res.status(500).json({ error: 'Unable to fetch access requests.' });
    }
  });

  router.post('/bookings', mutationLimiter, async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }

    const body = req.body;
    const validation = validateBookingInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const stationId = sanitizeText(body.stationId, 40);
      const studentName = sanitizeText(body.studentName, 80);
      const studentDepartment = body.studentDepartment as Department;
      const projectTitle = sanitizeText(body.projectTitle, 140);
      const requiredSpecs = sanitizeText(body.requiredSpecs, 240);
      const projectDeadline = String(body.projectDeadline);
      const date = String(body.date);
      const startHour = Number(body.startHour);
      const endHour = Number(body.endHour);
      const bayTrack = body.bayTrack as 'cross_dept_bay' | 'primary_equipment';
      const seatsRequested = Number(body.seatsRequested);
      const safetyCleared = body.safetyCleared !== false;
      const isReallocation = body.isReallocation === true;
      const aiNote = sanitizeText(body.aiAllocationNote, 320);

      type BookingOutcome =
        | { kind: 'not_found' }
        | { kind: 'conflict'; conflict: ConflictDetail }
        | { kind: 'created'; request: BookingRequest };

      const { store: updatedStore, result: outcome } = await mutateStore<BookingOutcome>((current) => {
        const station = current.stations.find((s) => s.id === stationId);
        if (!station) {
          return { kind: 'not_found' };
        }

        const conflict = checkSlotConflict(station, current.requests, {
          date,
          startHour,
          endHour,
          bayTrack,
          seatsRequested,
          studentDepartment,
        });

        if (conflict.hasConflict) {
          return { kind: 'conflict', conflict };
        }

        const isSameDept = studentDepartment === station.department;
        const autoApprove =
          bayTrack === 'cross_dept_bay' &&
          (isSameDept || station.shareableTrack.autoApproveCrossDept) &&
          safetyCleared;

        const status: RequestStatus = isReallocation
          ? 'reallocated'
          : autoApprove
          ? 'approved'
          : 'pending_faculty';

        const newRequest: BookingRequest = {
          id: `req-${randomUUID().slice(0, 12)}`,
          stationId: station.id,
          stationCode: station.code,
          stationName: station.name,
          stationDepartment: station.department,
          studentName,
          studentDepartment,
          projectTitle,
          requiredSpecs,
          projectDeadline,
          date,
          startHour,
          endHour,
          bayTrack,
          seatsRequested,
          status,
          safetyCleared,
          facultyNote:
            status === 'reallocated'
              ? 'Allocated via LabLink AI cross-department optimizer.'
              : status === 'approved'
              ? 'Auto-cleared for open cross-department bay access.'
              : `Pending ${station.facultySupervisor} project & safety review.`,
          aiAllocationNote: aiNote || undefined,
          createdAt: new Date().toISOString(),
        };

        current.requests.unshift(newRequest);
        return { kind: 'created', request: newRequest };
      });

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: 'Selected laboratory station does not exist.' });
        return;
      }

      if (outcome.kind === 'conflict') {
        res.status(409).json({
          error: outcome.conflict.reason,
          conflict: outcome.conflict,
        });
        return;
      }

      const utilization = computeUtilizationSummary(
        updatedStore.stations,
        updatedStore.requests,
        formatLocalIsoDate(),
        14
      );

      res.status(201).json({
        request: outcome.request,
        utilization,
      });
    } catch {
      res.status(500).json({ error: 'Failed to persist booking request.' });
    }
  });

  router.post('/ai/recommend', aiLimiter, async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }

    const body = req.body;
    const studentDepartment: Department = DEPARTMENTS.includes(body.studentDepartment as Department)
      ? (body.studentDepartment as Department)
      : 'CS & AI';

    const date =
      typeof body.date === 'string' && ISO_DATE_RE.test(body.date)
        ? body.date
        : formatLocalIsoDate();
    const startHour =
      Number.isInteger(Number(body.startHour)) &&
      Number(body.startHour) >= 8 &&
      Number(body.startHour) <= 19
        ? Number(body.startHour)
        : 14;
    const endHour =
      Number.isInteger(Number(body.endHour)) &&
      Number(body.endHour) > startHour &&
      Number(body.endHour) <= 21
        ? Number(body.endHour)
        : Math.min(21, startHour + 2);
    const seatsRequested =
      Number.isInteger(Number(body.seatsRequested)) &&
      Number(body.seatsRequested) >= 1 &&
      Number(body.seatsRequested) <= 8
        ? Number(body.seatsRequested)
        : 1;

    const projectTitle = sanitizeText(body.projectTitle, 140) || 'Cross-Department Research Task';
    const requiredSpecs = sanitizeText(body.requiredSpecs, 240) || 'GPU Workstation / Python';
    const studentName = sanitizeText(body.studentName, 80) || 'Student Researcher';
    const requestedStationId = sanitizeText(body.stationId, 40);
    const projectDeadline =
      typeof body.projectDeadline === 'string' && ISO_DATE_RE.test(body.projectDeadline)
        ? body.projectDeadline
        : date;

    try {
      const store = await readStore();
      const preferredStation =
        store.stations.find((s) => s.id === requestedStationId) ?? store.stations[4];

      const conflict = checkSlotConflict(preferredStation, store.requests, {
        date,
        startHour,
        endHour,
        bayTrack: body.bayTrack === 'primary_equipment' ? 'primary_equipment' : 'cross_dept_bay',
        seatsRequested,
        studentDepartment,
      });

      const candidates = generateCandidateAllocations(store.stations, store.requests, {
        preferredStationId: preferredStation.id,
        studentDepartment,
        requiredSpecs,
        projectDeadline,
        date,
        startHour,
        endHour,
        seatsRequested,
      });

      const aiResult = await generateFairAllocationRecommendations({
        studentName,
        studentDepartment,
        projectTitle,
        requiredSpecs,
        projectDeadline,
        preferredStationCode: preferredStation.code,
        date,
        startHour,
        endHour,
        conflictReason: conflict.hasConflict
          ? conflict.reason
          : 'Looking for optimal cross-departmental idle capacity match.',
        candidates,
      });

      res.json({
        conflict,
        candidates,
        allocation: aiResult,
      });
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Unable to generate allocation recommendations.' });
    }
  });

  router.patch('/requests/:id/decision', mutationLimiter, async (req, res) => {
    const requestId = req.params.id;
    if (!VALID_REQUEST_ID_RE.test(requestId)) {
      res.status(400).json({ error: 'Invalid request identifier.' });
      return;
    }

    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }

    const { decision, facultyNote } = req.body;
    if (typeof decision !== 'string' || !VALID_DECISIONS.has(decision)) {
      res.status(400).json({ error: 'Invalid faculty review decision.' });
      return;
    }

    try {
      let updatedRequest: BookingRequest | null = null;

      const { store: updatedStore } = await mutateStore((current) => {
        const target = current.requests.find((r) => r.id === requestId);
        if (!target) return current;

        const customNote = sanitizeText(facultyNote, 220);

        if (decision === 'approve') {
          target.status = 'approved';
          target.safetyCleared = true;
          target.facultyNote =
            customNote || 'Approved by Faculty Advisor (verified safety & project scope).';
        } else if (decision === 'preempt_for_deadline') {
          target.status = 'approved';
          target.safetyCleared = true;
          target.facultyNote =
            customNote || 'Priority deadline approval granted by Faculty Coordinator.';
        } else if (decision === 'request_orientation') {
          target.status = 'orientation_required';
          target.safetyCleared = false;
          target.facultyNote =
            customNote || 'Complete 15-minute lab safety briefing before bay unlock.';
        } else if (decision === 'reject') {
          target.status = 'rejected';
          target.facultyNote =
            customNote || 'Request declined; please use Smart Allocator for alternate slots.';
        }

        updatedRequest = { ...target };
        return current;
      });

      if (!updatedRequest) {
        res.status(404).json({ error: 'Access request not found.' });
        return;
      }

      const utilization = computeUtilizationSummary(
        updatedStore.stations,
        updatedStore.requests,
        formatLocalIsoDate(),
        14
      );

      res.json({
        request: updatedRequest,
        utilization,
      });
    } catch {
      res.status(500).json({ error: 'Failed to apply faculty decision.' });
    }
  });

  router.post('/reset', mutationLimiter, async (_req, res) => {
    try {
      const store = await resetStore();
      const utilization = computeUtilizationSummary(
        store.stations,
        store.requests,
        formatLocalIsoDate(),
        14
      );
      res.json({
        stations: store.stations,
        requests: store.requests,
        utilization,
        today: formatLocalIsoDate(),
      });
    } catch {
      res.status(500).json({ error: 'Failed to reset campus demo state.' });
    }
  });

  return router;
}
