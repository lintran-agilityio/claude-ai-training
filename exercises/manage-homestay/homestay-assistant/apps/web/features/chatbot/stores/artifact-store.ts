import { create } from "zustand";

import {
  ARTIFACT_KIND,
  ARTIFACT_STATUS,
  isArtifactInteractive,
  type Artifact,
  type ArtifactStatus,
} from "@/features/chatbot/types/artifact";
import { generateId } from "@/utils";

type ArtifactStore = {
  artifacts: Record<string, Artifact>;
  /** Stable map from CopilotKit tool call → artifact across remounts. */
  toolCallBindings: Record<string, string>;
  /**
   * Register a booking-form artifact and expire other interactive ones
   * (new book-flow starts).
   */
  registerBookingForm: (roomId: string, id?: string) => string;
  setStatus: (id: string, status: ArtifactStatus) => void;
  /**
   * Bind a get_room_by_id tool call to the latest idle booking-form for the
   * room (or register a fallback). Idempotent per toolCallId.
   */
  bindToolCall: (toolCallId: string, roomId: string) => string;
  /**
   * After confirm / create completes: submitting → outcome; leftover idle → expired.
   */
  finalizeBookingForms: (outcome: "success" | "cancelled") => void;
  reset: () => void;
};

const initialState = {
  artifacts: {} as Record<string, Artifact>,
  toolCallBindings: {} as Record<string, string>,
};

const touch = (
  artifact: Artifact,
  status: ArtifactStatus,
): Artifact => ({
  ...artifact,
  status,
  updatedAt: Date.now(),
});

const expireInteractive = (
  artifacts: Record<string, Artifact>,
  exceptId?: string,
): Record<string, Artifact> => {
  const next = { ...artifacts };
  for (const [id, artifact] of Object.entries(next)) {
    if (exceptId && id === exceptId) {
      continue;
    }
    if (
      artifact.kind === ARTIFACT_KIND.BOOKING_FORM &&
      isArtifactInteractive(artifact.status)
    ) {
      next[id] = touch(artifact, ARTIFACT_STATUS.EXPIRED);
    }
  }
  return next;
};

const findLatestIdleBookingForm = (
  artifacts: Record<string, Artifact>,
  roomId: string,
): Artifact | undefined => {
  let latest: Artifact | undefined;
  for (const artifact of Object.values(artifacts)) {
    if (
      artifact.kind !== ARTIFACT_KIND.BOOKING_FORM ||
      artifact.roomId !== roomId ||
      artifact.status !== ARTIFACT_STATUS.IDLE
    ) {
      continue;
    }
    if (!latest || artifact.updatedAt > latest.updatedAt) {
      latest = artifact;
    }
  }
  return latest;
};

export const useArtifactStore = create<ArtifactStore>()((set, get) => ({
  ...initialState,

  registerBookingForm: (roomId, id = generateId()) => {
    const now = Date.now();
    set((state) => {
      const artifacts = expireInteractive(state.artifacts, id);
      artifacts[id] = {
        id,
        kind: ARTIFACT_KIND.BOOKING_FORM,
        roomId,
        status: ARTIFACT_STATUS.IDLE,
        updatedAt: now,
      };
      return { artifacts };
    });
    return id;
  },

  setStatus: (id, status) =>
    set((state) => {
      const current = state.artifacts[id];
      if (!current || current.status === status) {
        return state;
      }
      return {
        artifacts: {
          ...state.artifacts,
          [id]: touch(current, status),
        },
      };
    }),

  bindToolCall: (toolCallId, roomId) => {
    const existing = get().toolCallBindings[toolCallId];
    if (existing) {
      return existing;
    }

    const idle = findLatestIdleBookingForm(get().artifacts, roomId);
    const artifactId =
      idle?.id ?? get().registerBookingForm(roomId);

    set((state) => ({
      toolCallBindings: {
        ...state.toolCallBindings,
        [toolCallId]: artifactId,
      },
    }));

    return artifactId;
  },

  finalizeBookingForms: (outcome) =>
    set((state) => {
      const artifacts = { ...state.artifacts };
      const now = Date.now();

      for (const [id, artifact] of Object.entries(artifacts)) {
        if (artifact.kind !== ARTIFACT_KIND.BOOKING_FORM) {
          continue;
        }

        if (artifact.status === ARTIFACT_STATUS.SUBMITTING) {
          artifacts[id] = {
            ...artifact,
            status:
              outcome === "success"
                ? ARTIFACT_STATUS.SUCCESS
                : ARTIFACT_STATUS.CANCELLED,
            updatedAt: now,
          };
          continue;
        }

        if (
          outcome === "success" &&
          artifact.status === ARTIFACT_STATUS.IDLE
        ) {
          artifacts[id] = {
            ...artifact,
            status: ARTIFACT_STATUS.EXPIRED,
            updatedAt: now,
          };
        }
      }

      return { artifacts };
    }),

  reset: () => set(initialState),
}));

export const selectArtifactStatus = (
  artifacts: Record<string, Artifact>,
  artifactId: string | null | undefined,
): ArtifactStatus | undefined =>
  artifactId ? artifacts[artifactId]?.status : undefined;
