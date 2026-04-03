import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response, Request } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let errors: Record<string, string[]> | undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()

      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const r = res as { message?: string | string[]; error?: string }
        if (Array.isArray(r.message)) {
          // Validation errors from class-validator
          message = 'Dữ liệu không hợp lệ'
          errors = { validation: r.message }
        } else {
          message = r.message ?? r.error ?? message
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`Unhandled error: ${exception.message}`, exception.stack)
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
