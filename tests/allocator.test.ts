import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSlotConflict,
  computeUtilizationSummary,
  generateCandidateAllocations,
  validateBookingInput,
} from '../server/allocator.ts';
import { createSeedData } from '../server/seed.ts';

test('validateBookingInput rejects invalid duration and accepts valid cross-dept request', () => {
  const invalid = validateBookingInput({
    stationId: 'bio-204',
    studentName: 'A',
    studentDepartment: 'CS & AI',
    projectTitle: 'ML Pipeline',
    requiredSpecs: 'CUDA',
    projectDeadline: '2026-11-25',
    date: '2026-11-23',
    startHour: 14,
    endHour: 16,
    bayTrack: 'cross_dept_bay',
    seatsRequested: 1,
  });
  assert.equal(invalid.valid, false);

  const overDuration = validateBookingInput({
    stationId: 'bio-204',
    studentName: 'Ananya Rao',
    studentDepartment: 'CS & AI',
    projectTitle: 'Genome Inference Benchmark',
    requiredSpecs: 'RTX 4080, CUDA 12',
    projectDeadline: '2026-11-25',
    date: '2026-11-23',
    startHour: 9,
    endHour: 18,
    bayTrack: 'cross_dept_bay',
    seatsRequested: 2,
  });
  assert.equal(overDuration.valid, false);

  const valid = validateBookingInput({
    stationId: 'bio-204',
    studentName: 'Ananya Rao',
    studentDepartment: 'CS & AI',
    projectTitle: 'Genome Inference Benchmark',
    requiredSpecs: 'RTX 4080, CUDA 12',
    projectDeadline: '2026-11-25',
    date: '2026-11-23',
    startHour: 14,
    endHour: 16,
    bayTrack: 'cross_dept_bay',
    seatsRequested: 2,
  });
  assert.equal(valid.valid, true);
});

test('checkSlotConflict detects saturated CS-102 annex and open BIO-204 cross-dept bay', () => {
  const today = '2026-11-23';
  const seed = createSeedData(today);
  const cs102 = seed.stations.find((s) => s.id === 'cs-102');
  const bio204 = seed.stations.find((s) => s.id === 'bio-204');
  assert.ok(cs102 && bio204);

  const csConflict = checkSlotConflict(cs102, seed.requests, {
    date: today,
    startHour: 14,
    endHour: 16,
    bayTrack: 'cross_dept_bay',
    seatsRequested: 2,
    studentDepartment: 'CS & AI',
  });
  assert.equal(csConflict.hasConflict, true);
  assert.equal(csConflict.availableSeatsAtRequestedTime, 0);

  const bioConflict = checkSlotConflict(bio204, seed.requests, {
    date: today,
    startHour: 14,
    endHour: 16,
    bayTrack: 'cross_dept_bay',
    seatsRequested: 2,
    studentDepartment: 'CS & AI',
  });
  assert.equal(bioConflict.hasConflict, false);
  assert.equal(bioConflict.availableSeatsAtRequestedTime, 14);
});

test('generateCandidateAllocations prioritizes idle cross-departmental windows like BIO-204', () => {
  const today = '2026-11-23';
  const seed = createSeedData(today);

  const candidates = generateCandidateAllocations(seed.stations, seed.requests, {
    preferredStationId: 'cs-102',
    studentDepartment: 'CS & AI',
    requiredSpecs: 'RTX 4080, CUDA 12, PyTorch',
    projectDeadline: '2026-11-24',
    date: today,
    startHour: 14,
    endHour: 16,
    seatsRequested: 2,
  });

  assert.ok(candidates.length >= 2);
  assert.equal(candidates[0].stationCode, 'BIO-204');
  assert.equal(candidates[0].isIdleWindowBonus, true);
  assert.ok(candidates[0].fairnessScore >= 85);
});

test('computeUtilizationSummary aggregates live idle capacity and cross-dept sessions', () => {
  const today = '2026-11-23';
  const seed = createSeedData(today);
  const summary = computeUtilizationSummary(seed.stations, seed.requests, today, 14);

  assert.equal(summary.activeHybridStations, 6);
  assert.ok(summary.idleBaysOpenNow > 30);
  assert.ok(summary.sharedHoursUnlockedWeekly >= 80);
  assert.equal(summary.pendingFacultyReviews, 2);
  const bioMetric = summary.departmentMetrics.find((m) => m.department === 'Biotech');
  assert.ok(bioMetric && bioMetric.hybridUtilizationPct > bioMetric.siloedUtilizationPct);
});
