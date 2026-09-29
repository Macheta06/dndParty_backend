import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(
      `Excepción de Prisma detectada [Código: ${exception?.code || 'N/A'}]: ${exception?.message}`,
      exception?.stack,
    );

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[]) || [];
        let message = 'Ya existe un registro con ese valor único.';

        if (Array.isArray(target) && target.includes('email')) {
          message = 'El correo electrónico ya está registrado.';
        } else if (Array.isArray(target) && target.includes('name')) {
          message = 'Ya existe un personaje con ese nombre. Elige un nombre distinto.';
        }

        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message,
          error: 'Conflict',
        });
      }

      if (exception.code === 'P2025') {
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'El registro solicitado no existe o fue eliminado.',
          error: 'Not Found',
        });
      }

      if (exception.code === 'P2003') {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Conflicto de relaciones en la base de datos (clave foránea).',
          error: 'Bad Request',
        });
      }
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error de conexión o de servidor en la base de datos. Por favor reintenta.',
      error: 'Internal Server Error',
    });
  }
}
