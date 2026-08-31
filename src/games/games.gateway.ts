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
import { GamesService } from './games.service';
import { RollDiceDto } from './dto/initiative.dto';
import { Inject, forwardRef } from '@nestjs/common';

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
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
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

  @SubscribeMessage('setInitiative')
  async handleSetInitiative(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      gameId: string;
      entries: Array<{ type: string; id: number; name: string; score: number }>;
    },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const entries = data.entries.map((e) => ({
        ...e,
        type: e.type as 'character' | 'npc',
      }));
      await this.gamesService.setInitiative(data.gameId, socketData.user.sub, {
        entries,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al establecer iniciativa';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('advanceTurn')
  async handleAdvanceTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.advanceTurn(data.gameId, socketData.user.sub);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al avanzar turno';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('clearInitiative')
  async handleClearInitiative(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.clearInitiative(data.gameId, socketData.user.sub);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al limpiar iniciativa';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('rollDice')
  handleRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RollDiceDto,
  ): void {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const result = this.gamesService.rollDice(
        socketData.user.sub,
        socketData.user.email,
        data.formula,
      );
      const roomId = this.extractGameId(client);
      if (roomId) {
        this.server.to(roomId).emit('diceRolled', result);
      } else {
        client.emit('diceRolled', result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al tirar dados';
      client.emit('error', { message });
    }
  }

  private extractGameId(client: Socket): string | undefined {
    const rooms = Array.from(client.rooms);
    return rooms.find((r) => r !== client.id);
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
