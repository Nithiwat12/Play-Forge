// Standard application error carrying an HTTP status code, so controllers
// can `throw new ApiError(...)` and the errorMiddleware turns it into a
// consistent JSON response.
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "ไม่ได้รับอนุญาต") {
    return new ApiError(401, message);
  }

  static forbidden(message = "ไม่มีสิทธิ์เข้าถึง") {
    return new ApiError(403, message);
  }

  static notFound(message = "ไม่พบข้อมูล") {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static internal(message = "เกิดข้อผิดพลาดของเซิร์ฟเวอร์") {
    return new ApiError(500, message);
  }
}
