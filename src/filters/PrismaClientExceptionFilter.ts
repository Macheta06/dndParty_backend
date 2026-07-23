import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'P2002') {
      // Error de restricción única (ej: email duplicado)
      throw new ConflictException('El email ya está registrado');
    }

    // Si no es P2002, lo dejamos pasar como error genérico
    response.status(500).json({
      statusCode: 500,
      message: 'Error interno en la base de datos',
    });
  }
}
