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
import { GrantXpDto } from './dto/grant-xp.dto';
import { CreateChatMessageDto } from './dto/chat.dto';
import { AddEquipmentDto, RemoveEquipmentDto } from './dto/equipment.dto';
import { Inject, forwardRef } from '@nestjs/common';

interface SocketData {
  user?: WsJwtPayload;
}

function getSocketData(client: Socket): SocketData {
  return client.data as SocketData;
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
  .split(',')
  .map((o) => normalizeOrigin(o.trim()));

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const normalized = normalizeOrigin(origin || '');
      if (!origin || allowedOrigins.includes(normalized)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  /** Map<socketId, { userId, gameId }> */
  private socketGameMap = new Map<string, { userId: number; gameId: string }>();

  /** Map<gameId, Map<userId, Set<socketId>>> — sockets conectados por usuario y sala */
  private roomUserSockets = new Map<string, Map<number, Set<string>>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
  ) {}

  private leaveRoomTracking(clientId: string): void {
    const info = this.socketGameMap.get(clientId);
    if (!info) return;

    this.socketGameMap.delete(clientId);

    const userSocketsMap = this.roomUserSockets.get(info.gameId);
    if (userSocketsMap) {
      const socketSet = userSocketsMap.get(info.userId);
      if (socketSet) {
        socketSet.delete(clientId);
        if (socketSet.size === 0) {
          userSocketsMap.delete(info.userId);
          if (userSocketsMap.size === 0) {
            this.roomUserSockets.delete(info.gameId);
          }

          this.server.to(info.gameId).emit('playerOffline', {
            userId: info.userId,
          });
        }
      }
    }
  }

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

    this.leaveRoomTracking(client.id);
  }

  @SubscribeMessage('leaveGameRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() gameId: string,
  ): Promise<void> {
    await client.leave(gameId);
    this.leaveRoomTracking(client.id);
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

    let characterName: string | undefined;
    const isMaster = game.masterId === data.user.sub;
    if (!isMaster) {
      const character = await this.prisma.character.findFirst({
        where: { gameId, userId: data.user.sub, is_npc: false },
      });
      if (!character) {
        client.emit('error', { message: 'No tienes acceso a esta sala' });
        return;
      }
      characterName = character.name;
    } else {
      characterName = 'Dungeon Master';
    }

    // Clean up previous room tracking for this socket if any
    this.leaveRoomTracking(client.id);

    await client.join(gameId);
    console.log(`Cliente ${client.id} se unió a la sala ${gameId}`);

    // Track socket & user in room
    this.socketGameMap.set(client.id, { userId: data.user.sub, gameId });

    let userSocketsMap = this.roomUserSockets.get(gameId);
    if (!userSocketsMap) {
      userSocketsMap = new Map<number, Set<string>>();
      this.roomUserSockets.set(gameId, userSocketsMap);
    }

    let socketSet = userSocketsMap.get(data.user.sub);
    const wasAlreadyOnline = Boolean(socketSet && socketSet.size > 0);
    if (!socketSet) {
      socketSet = new Set<string>();
      userSocketsMap.set(data.user.sub, socketSet);
    }
    socketSet.add(client.id);

    // Send full list of connected users to the new joiner
    client.emit('roomUsers', Array.from(userSocketsMap.keys()));

    // Notify others in room if user wasn't online before
    if (!wasAlreadyOnline) {
      client.to(gameId).emit('playerOnline', {
        userId: data.user.sub,
        characterName,
      });
    }
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

  @SubscribeMessage('grantXp')
  async handleGrantXp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GrantXpDto & { gameId: string },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.grantXp(data.gameId, socketData.user.sub, {
        xp: data.xp,
        characterId: data.characterId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al otorgar XP';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('chatMessage')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateChatMessageDto & { gameId: string },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.sendChatMessage(
        data.gameId,
        socketData.user.sub,
        { content: data.content },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al enviar mensaje';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('addEquipment')
  async handleAddEquipment(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: AddEquipmentDto & { gameId: string; characterId: number },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.addEquipment(
        data.gameId,
        data.characterId,
        socketData.user.sub,
        { name: data.name, quantity: data.quantity, description: data.description },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al agregar objeto';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('removeEquipment')
  async handleRemoveEquipment(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: RemoveEquipmentDto & { gameId: string; characterId: number },
  ): Promise<void> {
    const socketData = getSocketData(client);
    if (!socketData.user) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      await this.gamesService.removeEquipment(
        data.gameId,
        data.characterId,
        socketData.user.sub,
        { name: data.name, quantity: data.quantity },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al quitar objeto';
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
