export const ARTIFACT_STATUS = {
  IDLE: "idle",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type ArtifactStatus =
  (typeof ARTIFACT_STATUS)[keyof typeof ARTIFACT_STATUS];

export const ARTIFACT_KIND = {
  BOOKING_FORM: "booking-form",
} as const;

export type ArtifactKind = (typeof ARTIFACT_KIND)[keyof typeof ARTIFACT_KIND];

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  roomId: string;
  status: ArtifactStatus;
  updatedAt: number;
};

export const isArtifactInteractive = (status?: ArtifactStatus | null) =>
  status === ARTIFACT_STATUS.IDLE || status === ARTIFACT_STATUS.SUBMITTING;

export const isArtifactTerminal = (status?: ArtifactStatus | null) =>
  status === ARTIFACT_STATUS.SUCCESS ||
  status === ARTIFACT_STATUS.EXPIRED ||
  status === ARTIFACT_STATUS.CANCELLED;

/** Form fields / CTA locked once the artifact leaves idle. */
export const isArtifactLocked = (status?: ArtifactStatus | null) =>
  Boolean(status) && status !== ARTIFACT_STATUS.IDLE;
