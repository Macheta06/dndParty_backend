import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './games.gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GamesService } from './games.service';
import { WsJwtPayload } from '../auth/guard/ws-jwt/ws-jwt.guard';

interface MockSocketOverrides {
  token?: string;
  headers?: Record<string, unknown>;
}

interface MockSocket {
  id: string;
  handshake: {
    auth: Record<string, unknown>;
    headers: Record<string, unknown>;
  };
  data: Record<string, unknown>;
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
}

function createMockSocket(overrides: MockSocketOverrides = {}): MockSocket {
  const headers: Record<string, unknown> = overrides.headers ?? {};

  return {
    id: 'test-socket-id',
    handshake: {
      auth: { token: overrides['token'] ?? undefined },
      headers,
    },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

const validPayload: WsJwtPayload = { sub: 1, email: 'dm@test.com' };

const gameFixture = {
  id: 'game-1',
  name: 'La Cueva del Dragón',
  masterId: 1,
  joinCode: 'ABC123',
};

const playerCharacter = {
  id: 10,
  userId: 2,
  gameId: 'game-1',
  is_npc: false,
};

describe('GameGateway', () => {
  let gateway: GameGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let prisma: {
    game: { findUnique: jest.Mock };
    character: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    prisma = {
      game: { findUnique: jest.fn() },
      character: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        {
          provide: GamesService,
          useValue: {
            setInitiative: jest.fn(),
            advanceTurn: jest.fn(),
            clearInitiative: jest.fn(),
            rollDice: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get(GameGateway);
  });

  describe('handleConnection', () => {
    it('desconecta al cliente si no hay token', async () => {
      const client = createMockSocket({ token: undefined });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('desconecta al cliente si el token es inválido', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
      const client = createMockSocket({ token: 'bad-token' });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('no desconecta si el token es válido y guarda el payload', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload);
      const client = createMockSocket({ token: 'valid-token' });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user).toEqual(validPayload);
    });
  });

  describe('handleJoinRoom', () => {
    it('emite error si la partida no existe', async () => {
      prisma.game.findUnique.mockResolvedValue(null);
      const client = createMockSocket();
      client.data.user = validPayload;

      await gateway.handleJoinRoom(client as never, 'game-1');

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Partida no encontrada',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('emite error si el usuario no es master ni tiene personaje', async () => {
      prisma.game.findUnique.mockResolvedValue(gameFixture);
      prisma.character.findFirst.mockResolvedValue(null);
      const client = createMockSocket();
      client.data.user = { sub: 99, email: 'intruder@test.com' };

      await gateway.handleJoinRoom(client as never, 'game-1');

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'No tienes acceso a esta sala',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('permite unirse al master de la partida', async () => {
      prisma.game.findUnique.mockResolvedValue(gameFixture);
      const client = createMockSocket();
      client.data.user = validPayload;

      await gateway.handleJoinRoom(client as never, 'game-1');

      expect(client.join).toHaveBeenCalledWith('game-1');
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('permite unirse si el usuario tiene un personaje en la sala', async () => {
      prisma.game.findUnique.mockResolvedValue(gameFixture);
      prisma.character.findFirst.mockResolvedValue(playerCharacter);
      const client = createMockSocket();
      client.data.user = { sub: 2, email: 'player@test.com' };

      await gateway.handleJoinRoom(client as never, 'game-1');

      expect(client.join).toHaveBeenCalledWith('game-1');
      expect(client.emit).not.toHaveBeenCalled();
    });
  });
});
