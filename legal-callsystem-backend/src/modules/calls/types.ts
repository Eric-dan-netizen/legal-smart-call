export enum CallTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export enum CallStatus {
  INITIATED = 'initiated',
  DIALING = 'dialing',
  RINGING = 'ringing',
  ANSWERED = 'answered',
  IN_CONVERSATION = 'in_conversation',
  COMPLETED = 'completed',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  INVALID_NUMBER = 'invalid_number',
  REJECTED = 'rejected',
  FAILED = 'failed',
}
