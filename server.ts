import 'dotenv/config';
import express from 'express';
import path from 'path';
import type { BookingRequest, Department, RequestStatus } from './src/types/lablink.ts';
import {
  checkSlotConflict,
  computeUtilizationSummary,
  generateCandidateAllocations,
  validateBookingInput,
} from './server/allocator.ts';
import { GeminiServiceError, generateFairAllocationRecommendations } from './server/gemini.ts';
import { formatLocalIsoDate } from './server/seed.ts';
import { mutateStore, readStore, resetStore } from './server/store.ts';

const PORT = Number(process.env.PORT) || 3000;
const VALID_DEPARTMENTS: Department[] = ['Biotech', 'Aero & Mech', 'CS & AI', 'Electronics'];

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/labs', async (req, res) => {
    try {
      const store = await readStore();
      const today = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : formatLocalIsoDate();
      const hourParam = Number(req.query.hour);
      const currentHour = Number.isInteger(hourParam) && hourParam >= 8 && hourParam <= 20 ? hourParam : 14;

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
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to load laboratory inventory.',
      });
    }
  });

  app.get('/api/requests', async (_req, res) => {
    try {
      const store = await readStore();
      res.json({ requests: store.requests });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to fetch access requests.',
      });
    }
  });

  app.post('/api/bookings', async (req, res) => {
    const body = req.body ?? {};
    const validation = validateBookingInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const store = await readStore();
      const station = store.stations.find((s) => s.id === body.stationId);
      if (!station) {
        res.status(404).json({ error: 'Selected laboratory station does not exist.' });
        return;
      }

      const seatsRequested = Number(body.seatsRequested);
      const startHour = Number(body.startHour);
      const endHour = Number(body.endHour);

      const conflict = checkSlotConflict(station, store.requests, {
        date: body.date,
        startHour,
        endHour,
        bayTrack: body.bayTrack,
        seatsRequested,
        studentDepartment: body.studentDepartment,
      });

      if (conflict.hasConflict) {
        res.status(409).json({
          error: conflict.reason,
          conflict,
        });
        return;
      }

      const isSameDept = body.studentDepartment === station.department;
      const autoApprove =
        body.bayTrack === 'cross_dept_bay' &&
        (isSameDept || station.shareableTrack.autoApproveCrossDept) &&
        body.safetyCleared !== false;

      const status: RequestStatus = body.isReallocation
        ? 'reallocated'
        : autoApprove
        ? 'approved'
        : 'pending_faculty';

      const newRequest: BookingRequest = {
        id: `req-${Date.now().toString(36)}`,
        stationId: station.id,
        stationCode: station.code,
        stationName: station.name,
        stationDepartment: station.department,
        studentName: String(body.studentName).trim(),
        studentDepartment: body.studentDepartment,
        projectTitle: String(body.projectTitle).trim(),
        requiredSpecs: String(body.requiredSpecs).trim(),
        projectDeadline: body.projectDeadline,
        date: body.date,
        startHour,
        endHour,
        bayTrack: body.bayTrack,
        seatsRequested,
        status,
        safetyCleared: body.safetyCleared !== false,
        facultyNote:
          status === 'reallocated'
            ? 'Allocated via LabLink AI cross-department optimizer.'
            : status === 'approved'
            ? 'Auto-cleared for open cross-department bay access.'
            : `Pending ${station.facultySupervisor} project & safety review.`,
        aiAllocationNote:
          typeof body.aiAllocationNote === 'string' && body.aiAllocationNote.trim()
            ? body.aiAllocationNote.trim().slice(0, 320)
            : undefined,
        createdAt: new Date().toISOString(),
      };

      const { store: updatedStore } = await mutateStore((current) => {
        current.requests.unshift(newRequest);
        return current;
      });

      const utilization = computeUtilizationSummary(
        updatedStore.stations,
        updatedStore.requests,
        formatLocalIsoDate(),
        14
      );

      res.status(201).json({
        request: newRequest,
        utilization,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to persist booking request.',
      });
    }
  });

  app.post('/api/ai/recommend', async (req, res) => {
    const body = req.body ?? {};
    const studentDepartment: Department = VALID_DEPARTMENTS.includes(body.studentDepartment)
      ? body.studentDepartment
      : 'CS & AI';

    const date =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : formatLocalIsoDate();
    const startHour =
      Number.isInteger(Number(body.startHour)) && Number(body.startHour) >= 8 && Number(body.startHour) <= 19
        ? Number(body.startHour)
        : 14;
    const endHour =
      Number.isInteger(Number(body.endHour)) && Number(body.endHour) > startHour && Number(body.endHour) <= 21
        ? Number(body.endHour)
        : Math.min(21, startHour + 2);
    const seatsRequested =
      Number.isInteger(Number(body.seatsRequested)) && Number(body.seatsRequested) >= 1 && Number(body.seatsRequested) <= 8
        ? Number(body.seatsRequested)
        : 1;

    try {
      const store = await readStore();
      const preferredStation =
        store.stations.find((s) => s.id === body.stationId) ?? store.stations[4];

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
        requiredSpecs: typeof body.requiredSpecs === 'string' ? body.requiredSpecs : 'CUDA Python GPU',
        projectDeadline:
          typeof body.projectDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.projectDeadline)
            ? body.projectDeadline
            : date,
        date,
        startHour,
        endHour,
        seatsRequested,
      });

      const aiResult = await generateFairAllocationRecommendations({
        studentName: typeof body.studentName === 'string' ? body.studentName : 'Student Researcher',
        studentDepartment,
        projectTitle:
          typeof body.projectTitle === 'string' && body.projectTitle.trim()
            ? body.projectTitle.trim()
            : 'Cross-Department Research Task',
        requiredSpecs:
          typeof body.requiredSpecs === 'string' && body.requiredSpecs.trim()
            ? body.requiredSpecs.trim()
            : 'GPU Workstation / Python',
        projectDeadline:
          typeof body.projectDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.projectDeadline)
            ? body.projectDeadline
            : date,
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
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to generate allocation recommendations.',
      });
    }
  });

  app.patch('/api/requests/:id/decision', async (req, res) => {
    const requestId = req.params.id;
    const { decision, facultyNote } = req.body ?? {};
    const validDecisions = new Set([
      'approve',
      'request_orientation',
      'reject',
      'preempt_for_deadline',
    ]);

    if (!validDecisions.has(decision)) {
      res.status(400).json({ error: 'Invalid faculty review decision.' });
      return;
    }

    try {
      let updatedRequest: BookingRequest | null = null;

      const { store: updatedStore } = await mutateStore((current) => {
        const target = current.requests.find((r) => r.id === requestId);
        if (!target) return current;

        const customNote =
          typeof facultyNote === 'string' && facultyNote.trim()
            ? facultyNote.trim().slice(0, 220)
            : '';

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
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to apply faculty decision.',
      });
    }
  });

  app.post('/api/reset', async (_req, res) => {
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
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to reset campus demo state.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

createApp()
  .then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`LabLink server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start LabLink server:', err);
    process.exit(1);
  });
