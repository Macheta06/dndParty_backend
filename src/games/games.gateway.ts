import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WsJwtPayload } from '../auth/guard/ws-jwt/ws-jwt.guard';

interface SocketData {
  user?: WsJwtPayload;
}

function getSocketData(client: Socket): SocketData {
  return client.data as SocketData;
}

@WebSocketGateway({ cors: { origin: 'http://localhost:3001' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      console.log(`Cliente ${client.id} desconectado: sin token`);
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<WsJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      getSocketData(client).user = payload;
      console.log(`Cliente conectado: ${client.id} (user: ${payload.sub})`);
    } catch {
      console.log(`Cliente ${client.id} desconectado: token inválido`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const data = getSocketData(client);
    console.log(
      `Cliente desconectado: ${client.id}${data.user ? ` (user: ${data.user.sub})` : ''}`,
    );
  }

  @SubscribeMessage('joinGameRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() gameId: string,
  ): Promise<void> {
    const data = getSocketData(client);
    if (!data.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      client.emit('error', { message: 'Partida no encontrada' });
      return;
    }

    const isMaster = game.masterId === data.user.sub;
    if (!isMaster) {
      const character = await this.prisma.character.findFirst({
        where: { gameId, userId: data.user.sub, is_npc: false },
      });
      if (!character) {
        client.emit('error', { message: 'No tienes acceso a esta sala' });
        return;
      }
    }

    await client.join(gameId);
    console.log(`Cliente ${client.id} se unió a la sala ${gameId}`);
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown>;
    if (typeof auth?.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const raw = client.handshake.headers.authorization;
    if (typeof raw === 'string') {
      const [type, token] = raw.split(' ');
      return type === 'Bearer' ? token : undefined;
    }

    return undefined;
  }
}
