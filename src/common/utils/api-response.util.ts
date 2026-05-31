import { ApiResponse } from '../interfaces/api-response.interface';

export function successResponse<T>(
  data: T,
  message = 'Operation completed',
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}
