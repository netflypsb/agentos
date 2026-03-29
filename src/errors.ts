// Comprehensive error handling and validation system

export enum ErrorCode {
  // Database errors (1000-1099)
  DATABASE_CONNECTION_FAILED = "E1000",
  DATABASE_QUERY_FAILED = "E1001", 
  DATABASE_CONSTRAINT_VIOLATION = "E1002",
  DATABASE_TIMEOUT = "E1003",
  
  // Validation errors (1100-1199)
  INVALID_INPUT_FORMAT = "E1100",
  MISSING_REQUIRED_PARAMETER = "E1101",
  INVALID_PARAMETER_VALUE = "E1102",
  PARAMETER_OUT_OF_RANGE = "E1103",
  
  // Business logic errors (1200-1299)
  DAILY_LIMIT_EXCEEDED = "E1200",
  KEY_NOT_FOUND = "E1201",
  NAMESPACE_NOT_FOUND = "E1202",
  TTL_EXPIRED = "E1203",
  
  // System errors (1300-1399)
  FILE_SYSTEM_ERROR = "E1300",
  PERMISSION_DENIED = "E1301",
  RESOURCE_EXHAUSTED = "E1302",
  INTERNAL_SERVER_ERROR = "E1303",
  
  // Format conversion errors (1400-1499)
  UNSUPPORTED_INPUT_FORMAT = "E1400",
  UNSUPPORTED_OUTPUT_FORMAT = "E1401",
  CONVERSION_FAILED = "E1402",
  INVALID_CONTENT = "E1403",
  
  // License errors (1500-1599)
  LICENSE_INVALID = "E1500",
  LICENSE_EXPIRED = "E1501",
  FEATURE_NOT_LICENSED = "E1502",
  LICENSE_VALIDATION_FAILED = "E1503"
}

export interface AgentError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export class AgentErrorFactory {
  static create(code: ErrorCode, message: string, details?: any): AgentError {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    };
  }

  static databaseError(operation: string, originalError: Error): AgentError {
    return this.create(
      ErrorCode.DATABASE_QUERY_FAILED,
      `Database operation failed: ${operation}`,
      { originalError: originalError.message, operation }
    );
  }

  static validationError(parameter: string, value: any, expectedType: string): AgentError {
    return this.create(
      ErrorCode.INVALID_PARAMETER_VALUE,
      `Invalid parameter '${parameter}': expected ${expectedType}, got ${typeof value}`,
      { parameter, value, expectedType }
    );
  }

  static limitExceededError(limit: number, current: number, resource: string): AgentError {
    return this.create(
      ErrorCode.DAILY_LIMIT_EXCEEDED,
      `${resource} limit exceeded: ${current}/${limit}`,
      { limit, current, resource }
    );
  }

  static formatError(inputFormat: string, outputFormat: string, reason: string): AgentError {
    return this.create(
      ErrorCode.CONVERSION_FAILED,
      `Format conversion failed: ${inputFormat} → ${outputFormat}`,
      { inputFormat, outputFormat, reason }
    );
  }

  private static generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

// Input validation utilities
export class ValidationUtils {
  static validateString(value: any, minLength: number = 0, maxLength: number = 1000): string {
    if (typeof value !== 'string') {
      throw AgentErrorFactory.validationError('value', value, 'string');
    }
    if (value.length < minLength) {
      throw AgentErrorFactory.validationError('value', value, `string with min length ${minLength}`);
    }
    if (value.length > maxLength) {
      throw AgentErrorFactory.validationError('value', value, `string with max length ${maxLength}`);
    }
    return value;
  }

  static validateNumber(value: any, min: number = -Infinity, max: number = Infinity): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw AgentErrorFactory.validationError('value', value, 'number');
    }
    if (value < min) {
      throw AgentErrorFactory.validationError('value', value, `number >= ${min}`);
    }
    if (value > max) {
      throw AgentErrorFactory.validationError('value', value, `number <= ${max}`);
    }
    return value;
  }

  static validateDate(value: any): string {
    if (typeof value !== 'string') {
      throw AgentErrorFactory.validationError('value', value, 'date string');
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw AgentErrorFactory.validationError('value', value, 'valid date string (YYYY-MM-DD)');
    }
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  static validateJSON(value: any): any {
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value !== 'string') {
      throw AgentErrorFactory.validationError('value', value, 'JSON string or object');
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      throw AgentErrorFactory.validationError('value', value, 'valid JSON string');
    }
  }

  static validateNamespace(value: string): string {
    const namespace = this.validateString(value, 1, 50);
    if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) {
      throw AgentErrorFactory.validationError('namespace', value, 'alphanumeric, underscore, or hyphen');
    }
    return namespace;
  }

  static validateKey(value: string): string {
    const key = this.validateString(value, 1, 255);
    if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
      throw AgentErrorFactory.validationError('key', value, 'alphanumeric, dot, underscore, or hyphen');
    }
    return key;
  }
}

// Error response formatter
export function formatError(error: AgentError): any {
  return {
    content: [{ 
      type: "text", 
      text: `[${error.code}] ${error.message}` 
    }],
    isError: true,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
      requestId: error.requestId
    }
  };
}

// Graceful error handler wrapper
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        // Already an AgentError, re-throw
        throw error;
      }
      
      // Convert to AgentError
      const agentError = AgentErrorFactory.create(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Unexpected error: ${(error as Error).message}`,
        { originalError: (error as Error).stack }
      );
      
      throw agentError;
    }
  };
}
