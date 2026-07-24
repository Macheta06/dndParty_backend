import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'P2002') {
      return response.status(409).json({
        statusCode: 409,
        message: 'This email is already registered',
      });
    }

    // Si no es P2002, lo dejamos pasar como error genérico
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
