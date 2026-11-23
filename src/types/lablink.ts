export type Department =
  | 'Biotech'
  | 'Aero & Mech'
  | 'CS & AI'
  | 'Electronics';

export type ResourceCategory =
  | 'Compute & GPU'
  | 'Fabrication & CNC'
  | 'Wet & Bio Lab'
  | 'Hardware & IoT';

export type BayTrack = 'cross_dept_bay' | 'primary_equipment';

export type RequestStatus =
  | 'pending_faculty'
  | 'approved'
  | 'reallocated'
  | 'orientation_required'
  | 'rejected';

export type SafetyTier = 'Standard Compute' | 'Workshop Certified' | 'Biosafety Level 1';

export interface ClassIdleWindow {
  id: string;
  label: string;
  days: string;
  startHour: number;
  endHour: number;
  primaryActivity: string;
  openCrossDeptBays: number;
}

export interface LabStation {
  id: string;
  code: string;
  name: string;
  department: Department;
  building: string;
  room: string;
  category: ResourceCategory;
  imageUrl: string;
  safetyTier: SafetyTier;
  facultySupervisor: string;
  primaryTrack: {
    title: string;
    capacity: number;
    equipment: string[];
  };
  shareableTrack: {
    title: string;
    capacity: number;
    specs: string;
    software: string[];
    eligibleDepartments: Department[];
    autoApproveCrossDept: boolean;
  };
  idleWindows: ClassIdleWindow[];
  baselineSiloUtilizationPct: number;
}

export interface BookingRequest {
  id: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  stationDepartment: Department;
  studentName: string;
  studentDepartment: Department;
  projectTitle: string;
  requiredSpecs: string;
  projectDeadline: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  bayTrack: BayTrack;
  seatsRequested: number;
  status: RequestStatus;
  safetyCleared: boolean;
  facultyNote: string;
  aiAllocationNote?: string;
  createdAt: string;
}

export interface CandidateAllocation {
  candidateId: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  stationDepartment: Department;
  bayTrack: BayTrack;
  date: string;
  startHour: number;
  endHour: number;
  availableSeats: number;
  totalBayCapacity: number;
  isIdleWindowBonus: boolean;
  idleWindowReason: string | null;
  fairnessScore: number;
  specMatchScore: number;
  deadlineUrgencyScore: number;
  autoApproveEligible: boolean;
}

export interface ConflictDetail {
  hasConflict: boolean;
  reason: string;
  requestedStationCode: string;
  availableSeatsAtRequestedTime: number;
  conflictingRequests: Array<{
    id: string;
    projectTitle: string;
    studentDepartment: Department;
    startHour: number;
    endHour: number;
    seatsRequested: number;
  }>;
}

export interface AiRecommendationItem {
  candidateId: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  stationDepartment: Department;
  bayTrack: BayTrack;
  date: string;
  startHour: number;
  endHour: number;
  fairnessScore: number;
  isIdleWindowBonus: boolean;
  autoApproveEligible: boolean;
  rationale: string;
  crossDeptBenefit: string;
  tradeOff: string;
}

export interface AiAllocationResponse {
  summary: string;
  fairnessPolicyNote: string;
  recommendations: AiRecommendationItem[];
}

export interface DepartmentFlowMetric {
  department: Department;
  siloedUtilizationPct: number;
  hybridUtilizationPct: number;
  sharedHoursUnlocked: number;
  crossDeptHostedSessions: number;
  bottleneckReliefPct: number;
}

export interface CampusUtilizationSummary {
  activeHybridStations: number;
  totalShareableBays: number;
  idleBaysOpenNow: number;
  sharedHoursUnlockedWeekly: number;
  pendingFacultyReviews: number;
  conflictResolutionRatePct: number;
  departmentMetrics: DepartmentFlowMetric[];
  stationOccupancy: Array<{
    stationId: string;
    code: string;
    name: string;
    department: Department;
    bookedSeatsToday: number;
    totalCrossDeptSeats: number;
    crossDeptIdleNow: number;
    activeIdleWindowLabel: string | null;
  }>;
}

export interface LabLinkStoreData {
  stations: LabStation[];
  requests: BookingRequest[];
}
