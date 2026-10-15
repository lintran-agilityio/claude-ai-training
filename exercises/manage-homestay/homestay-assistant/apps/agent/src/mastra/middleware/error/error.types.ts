export type ErrorStatusCode = 401 | 500;

export type MappedErrorResponse = {
  status: ErrorStatusCode;
  body: {
    error: string;
  };
};

export type ErrorMapperInput = {
  error: unknown;
};
