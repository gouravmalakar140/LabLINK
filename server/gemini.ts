import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiAllocationResponse,
  AiRecommendationItem,
  CandidateAllocation,
  Department,
} from '../src/types/lablink.ts';
import { formatHour } from './allocator.ts';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured in the server environment.',
      503
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface RecommendParams {
  studentName: string;
  studentDepartment: Department;
  projectTitle: string;
  requiredSpecs: string;
  projectDeadline: string;
  preferredStationCode: string;
  date: string;
  startHour: number;
  endHour: number;
  conflictReason: string;
  candidates: CandidateAllocation[];
}

export async function generateFairAllocationRecommendations(
  params: RecommendParams
): Promise<AiAllocationResponse> {
  if (params.candidates.length === 0) {
    return {
      summary:
        'No open cross-departmental bays matched the exact window and seat count. Try reducing seats requested or shifting by 1–2 hours.',
      fairnessPolicyNote:
        'Fairness policy prioritizes projects with imminent deadlines and routes compute workloads into idle wet-lab or CAD bays.',
      recommendations: [],
    };
  }

  const ai = createGeminiClient();

  const candidateLookup = new Map(params.candidates.map((c) => [c.candidateId, c]));

  const promptPayload = {
    request: {
      studentDepartment: params.studentDepartment,
      projectTitle: params.projectTitle,
      requiredSpecs: params.requiredSpecs,
      projectDeadline: params.projectDeadline,
      preferredStation: params.preferredStationCode,
      preferredWindow: `${params.date} ${formatHour(params.startHour)}-${formatHour(params.endHour)}`,
      conflictReason: params.conflictReason,
    },
    verifiedCandidates: params.candidates.map((c) => ({
      candidateId: c.candidateId,
      stationCode: c.stationCode,
      stationName: c.stationName,
      stationDepartment: c.stationDepartment,
      window: `${formatHour(c.startHour)}-${formatHour(c.endHour)}`,
      availableSeats: c.availableSeats,
      totalBayCapacity: c.totalBayCapacity,
      isIdleWindowBonus: c.isIdleWindowBonus,
      idleWindowReason: c.idleWindowReason,
      fairnessScore: c.fairnessScore,
      specMatchScore: c.specMatchScore,
      autoApproveEligible: c.autoApproveEligible,
    })),
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this campus lab scheduling conflict and rank the top 3 feasible cross-departmental allocations from verifiedCandidates ONLY. Return valid JSON matching the schema.\n\n${JSON.stringify(promptPayload)}`,
      config: {
        systemInstruction:
          'You are LabLink AI, a campus laboratory resource allocator. Recommend fair, feasible cross-departmental lab allocations using ONLY the provided candidateId values. Highlight how idle compute/fabrication bays in other departments (such as Biotech wet-lab hours or Aerospace theory blocks) relieve bottlenecks while respecting project deadlines and safety tiers. Keep explanations concise, specific, and practical (under 35 words per field).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence overview of the recommended conflict resolution.',
            },
            fairnessPolicyNote: {
              type: Type.STRING,
              description: 'Brief note explaining how deadline urgency and cross-dept idle capacity were balanced.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  candidateId: {
                    type: Type.STRING,
                    description: 'Exact candidateId from verifiedCandidates.',
                  },
                  rationale: {
                    type: Type.STRING,
                    description: 'Why this slot is fair and technically feasible for the project.',
                  },
                  crossDeptBenefit: {
                    type: Type.STRING,
                    description: 'How this uses idle cross-departmental capacity or relieves bottlenecks.',
                  },
                  tradeOff: {
                    type: Type.STRING,
                    description: 'Any minor trade-off such as walking to another building or shifting 1-2 hours.',
                  },
                },
                required: ['candidateId', 'rationale', 'crossDeptBenefit', 'tradeOff'],
              },
            },
          },
          required: ['summary', 'fairnessPolicyNote', 'recommendations'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new GeminiServiceError('Gemini returned an empty allocation response.', 502);
    }

    const parsed = JSON.parse(rawText) as {
      summary?: string;
      fairnessPolicyNote?: string;
      recommendations?: Array<{
        candidateId: string;
        rationale: string;
        crossDeptBenefit: string;
        tradeOff: string;
      }>;
    };

    const verifiedRecs: AiRecommendationItem[] = [];
    const seenIds = new Set<string>();

    for (const rec of parsed.recommendations ?? []) {
      const candidate = candidateLookup.get(rec.candidateId);
      if (!candidate || seenIds.has(rec.candidateId)) continue;
      seenIds.add(rec.candidateId);

      verifiedRecs.push({
        candidateId: candidate.candidateId,
        stationId: candidate.stationId,
        stationCode: candidate.stationCode,
        stationName: candidate.stationName,
        stationDepartment: candidate.stationDepartment,
        bayTrack: candidate.bayTrack,
        date: candidate.date,
        startHour: candidate.startHour,
        endHour: candidate.endHour,
        fairnessScore: candidate.fairnessScore,
        isIdleWindowBonus: candidate.isIdleWindowBonus,
        autoApproveEligible: candidate.autoApproveEligible,
        rationale: rec.rationale,
        crossDeptBenefit: rec.crossDeptBenefit,
        tradeOff: rec.tradeOff,
      });
    }

    // Ensure at least top verified candidates are mapped if model omitted valid IDs
    if (verifiedRecs.length === 0) {
      throw new GeminiServiceError(
        'Gemini response did not reference valid candidate slot identifiers.',
        502
      );
    }

    return {
      summary:
        parsed.summary ||
        'Cross-departmental hybrid bays can accommodate your project without delaying your deadline.',
      fairnessPolicyNote:
        parsed.fairnessPolicyNote ||
        'Allocations balance project deadline urgency, technical spec match, and idle cross-departmental bay capacity.',
      recommendations: verifiedRecs.slice(0, 3),
    };
  } catch (err) {
    if (err instanceof GeminiServiceError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Failed to reach Gemini allocation engine.';
    throw new GeminiServiceError(message, 502);
  }
}
