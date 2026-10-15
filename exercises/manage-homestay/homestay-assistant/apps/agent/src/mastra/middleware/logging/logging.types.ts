export type RequestLogContext = {
  method: string;
  path: string;
};

export type ResponseLogContext = RequestLogContext & {
  status: number;
  durationMs: number;
};

export type LoggingConfig = {
  excludePaths?: string[];
};
