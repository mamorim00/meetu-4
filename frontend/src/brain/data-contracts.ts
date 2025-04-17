/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/** TestDatabaseRequest */
export interface TestDatabaseRequest {
  /** Path */
  path: string;
}

/** TestDatabaseResponse */
export interface TestDatabaseResponse {
  /** Success */
  success: boolean;
  /** Message */
  message: string;
  /** Data */
  data?: Record<string, any>;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type CheckHealthData = HealthResponse;

export type TestDatabaseData = TestDatabaseResponse;

export type TestDatabaseError = HTTPValidationError;
