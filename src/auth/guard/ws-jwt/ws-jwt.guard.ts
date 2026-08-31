import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

export interface WsJwtPayload {
  sub: number;
  email: string;
}

interface SocketData {
  user?: WsJwtPayload;
}

function getSocketData(client: Socket): SocketData {
  return client.data as SocketData;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('No autenticado');
    }

    try {
      const payload = await this.jwtService.verifyAsync<WsJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      getSocketData(client).user = payload;
      return true;
    } catch {
      throw new WsException('Token inválido');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown>;
    if (typeof auth?.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const headers = client.handshake.headers;
    const raw = headers.authorization;
    if (typeof raw === 'string') {
      const [type, token] = raw.split(' ');
      return type === 'Bearer' ? token : undefined;
    }

    return undefined;
  }
}
