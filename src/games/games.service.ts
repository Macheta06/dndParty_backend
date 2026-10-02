import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { randomBytes } from 'crypto';
import { JoinGameDto } from './dto/join-game.dto';
import { CreateNoteDto, UpdateHpDto } from './dto/dm-actions.dto';
import { CreateNpcDto } from './dto/create-npc.dto';
import { GameGateway } from './games.gateway';
import { SetInitiativeDto } from './dto/initiative.dto';
import { GrantXpDto } from './dto/grant-xp.dto';
import { CreateChatMessageDto } from './dto/chat.dto';
import { AddEquipmentDto, RemoveEquipmentDto } from './dto/equipment.dto';

export interface InitiativeEntry {
  type: 'character' | 'npc';
  id: number;
  name: string;
  score: number;
}

export interface InitiativeState {
  entries: InitiativeEntry[];
  currentTurn: number;
  round: number;
}

interface DiceRollResult {
  userId: number;
  userName: string;
  formula: string;
  rolls: number[];
  total: number;
}

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private gameGateway: GameGateway,
  ) {}

  async createGame(masterId: number, createGameDto: CreateGameDto) {
    const joinCode = randomBytes(3).toString('hex').toUpperCase();

    return this.prisma.game.create({
      data: {
        name: createGameDto.name,
        joinCode,
        masterId,
      },
    });
  }

  async getGamesByMaster(masterId: number) {
    return this.prisma.game.findMany({
      where: {
        masterId,
      },
    });
  }

  async getGameById(id: string, userId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        characters: true,
        notes: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Partida no encontrada');
    }

    const { characters, notes, ...rest } = game;

    return {
      ...rest,
      characters: characters.filter((character) => !character.is_npc),
      npcs: characters.filter((character) => character.is_npc),
      notes:
        game.masterId === userId
          ? notes
          : notes.filter((note) => note.is_public),
    };
  }

  async joinGame(userId: number, joinGameDto: JoinGameDto) {
    const { joinCode, characterId } = joinGameDto;
    const game = await this.prisma.game.findUnique({
      where: {
        joinCode,
      },
    });

    if (!game) {
      throw new NotFoundException('No existe ninguna partida con el código');
    }

    const character = await this.prisma.character.findUnique({
      where: {
        id: characterId,
      },
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    if (character.gameId) {
      if (character.gameId === game.id) {
        throw new ConflictException('Este personaje ya está en una partida');
      }
      throw new ConflictException(
        'Este personaje ya está jugando en otra sala',
      );
    }

    const updatedCharacter = await this.prisma.character.update({
      where: { id: characterId },
      data: { gameId: game.id },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            master: { select: { name: true } },
          },
        },
      },
    });

    this.gameGateway.server.to(game.id).emit('characterJoined', updatedCharacter);

    return {
      id: updatedCharacter.id,
      name: updatedCharacter.name,
      game: updatedCharacter.game,
    };
  }

  async leaveGame(gameId: string, userId: number) {
    const character = await this.prisma.character.findFirst({
      where: {
        userId: userId,
        gameId: gameId,
      },
    });

    if (!character) {
      throw new NotFoundException('No tienes ningún personaje en esta partida');
    }

    const updatedCharacter = await this.prisma.character.update({
      where: { id: character.id },
      data: { gameId: null },
    });

    this.gameGateway.server.to(gameId).emit('playerLeft', character.id);

    return updatedCharacter;
  }

  private async verifyGameMaster(gameId: string, userId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Partida no encontrada');
    }
    if (game.masterId !== userId) {
      throw new ForbiddenException(
        'Solo el Dungeon Master puede realizar esta acción',
      );
    }
    return game;
  }

  async updateCharacterHp(
    gameId: string,
    characterId: number,
    userId: number,
    hpDto: UpdateHpDto,
  ) {
    await this.verifyGameMaster(gameId, userId);
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        gameId,
      },
    });
    if (!character)
      throw new NotFoundException('El personaje no está en esta partida');

    const updatedCharacter = await this.prisma.character.update({
      where: {
        id: characterId,
      },
      data: { current_hp: hpDto.current_hp },
    });

    this.gameGateway.server.to(gameId).emit('hpUpdated', {
      characterId: characterId,
      current_hp: hpDto.current_hp,
    });

    return updatedCharacter;
  }

  async createNpc(gameId: string, userId: number, npcDto: CreateNpcDto) {
    await this.verifyGameMaster(gameId, userId);

    const npcDefaults: Prisma.CharacterUncheckedCreateInput = {
      name: npcDto.name,
      class: npcDto.class ?? 'Enemigo',
      race: npcDto.race ?? 'Desconocido',
      background: 'NPC',
      alignment: 'Neutral',
      level: 1,
      exp: 0,
      proficiency: 2,
      inspiration: 0,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      armor: 10,
      initiative: 0,
      speed: 30,
      max_hp: npcDto.max_hp,
      current_hp: npcDto.current_hp,
      temporary_hp: 0,
      hitDice: '1d8',
      equipment: [],
      proficiencies: [],
      spells: [],
      is_npc: true,
      userId,
      gameId,
    };

    try {
      const createdNpc = await this.prisma.character.create({
        data: npcDefaults,
      });

      this.gameGateway.server.to(gameId).emit('npcCreated', createdNpc);

      return createdNpc;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un personaje con ese nombre');
      }
      throw error;
    }
  }

  async deleteNpc(gameId: string, userId: number, npcId: number) {
    await this.verifyGameMaster(gameId, userId);

    const npc = await this.prisma.character.findFirst({
      where: { id: npcId, gameId, is_npc: true },
    });

    if (!npc) {
      throw new NotFoundException('El enemigo no existe en esta partida');
    }

    const updated = await this.prisma.character.update({
      where: { id: npcId },
      data: { deleted: true, gameId: null },
    });

    // Remueve al NPC de la iniciativa activa si estaba presente
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (game && game.initiative) {
      const state = game.initiative as unknown as InitiativeState;
      if (
        state.entries &&
        state.entries.some((e) => e.type === 'npc' && e.id === npcId)
      ) {
        const filteredEntries = state.entries.filter(
          (e) => !(e.type === 'npc' && e.id === npcId),
        );
        if (filteredEntries.length === 0) {
          await this.prisma.game.update({
            where: { id: gameId },
            data: { initiative: Prisma.DbNull },
          });
          this.gameGateway.server.to(gameId).emit('initiativeCleared');
        } else {
          const nextTurn =
            state.currentTurn >= filteredEntries.length
              ? 0
              : state.currentTurn;
          const newState: InitiativeState = {
            ...state,
            entries: filteredEntries,
            currentTurn: nextTurn,
          };
          await this.prisma.game.update({
            where: { id: gameId },
            data: { initiative: newState as unknown as Prisma.InputJsonValue },
          });
          this.gameGateway.server
            .to(gameId)
            .emit('initiativeUpdated', newState);
        }
      }
    }

    this.gameGateway.server.to(gameId).emit('npcDeleted', npcId);
    return updated;
  }

  async createNote(gameId: string, userId: number, noteDto: CreateNoteDto) {
    await this.verifyGameMaster(gameId, userId);

    const note = await this.prisma.note.create({
      data: {
        ...noteDto,
        gameId,
      },
    });

    this.gameGateway.server.to(gameId).emit('noteCreated', note);

    return note;
  }

  async setInitiative(
    gameId: string,
    userId: number,
    dto: SetInitiativeDto,
  ): Promise<InitiativeState> {
    await this.verifyGameMaster(gameId, userId);

    const participantIds = dto.entries.map((e) => e.id);
    const characters = await this.prisma.character.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, dexterity: true },
    });
    const dexMap = new Map<number, number>();
    characters.forEach((c) => dexMap.set(c.id, c.dexterity));

    const sorted = [...dto.entries].sort((a, b) => {
      // 1. Mayor resultado de iniciativa
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 2. Desempate por atributo de Destreza (DEX)
      const dexA = dexMap.get(a.id) ?? 10;
      const dexB = dexMap.get(b.id) ?? 10;
      if (dexB !== dexA) {
        return dexB - dexA;
      }
      // 3. Desempate: Jugadores (PCs) antes que Enemigos (NPCs)
      if (a.type !== b.type) {
        return a.type === 'character' ? -1 : 1;
      }
      // 4. Desempate alfabético por nombre
      return a.name.localeCompare(b.name);
    });

    const state: InitiativeState = {
      entries: sorted,
      currentTurn: 0,
      round: 1,
    };

    await this.prisma.game.update({
      where: { id: gameId },
      data: { initiative: state as unknown as Prisma.InputJsonValue },
    });

    this.gameGateway.server.to(gameId).emit('initiativeUpdated', state);
    return state;
  }

  async advanceTurn(gameId: string, userId: number): Promise<InitiativeState> {
    await this.verifyGameMaster(gameId, userId);

    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Partida no encontrada');

    const state = game.initiative as unknown as InitiativeState | null;
    if (!state || state.entries.length === 0) {
      throw new BadRequestException('No hay iniciativa activa');
    }

    const nextTurn = state.currentTurn + 1;
    if (nextTurn >= state.entries.length) {
      state.currentTurn = 0;
      state.round += 1;
    } else {
      state.currentTurn = nextTurn;
    }

    await this.prisma.game.update({
      where: { id: gameId },
      data: { initiative: state as unknown as Prisma.InputJsonValue },
    });

    this.gameGateway.server.to(gameId).emit('turnAdvanced', state);
    return state;
  }

  async clearInitiative(gameId: string, userId: number): Promise<void> {
    await this.verifyGameMaster(gameId, userId);

    await this.prisma.game.update({
      where: { id: gameId },
      data: { initiative: Prisma.DbNull },
    });

    this.gameGateway.server.to(gameId).emit('initiativeCleared');
  }

  rollDice(userId: number, userName: string, formula: string): DiceRollResult {
    const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!match) {
      throw new BadRequestException(`Fórmula inválida: ${formula}`);
    }

    const count = match[1] === '' ? 1 : parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    if (count < 1 || count > 100) {
      throw new BadRequestException('Cantidad de dados inválida (1-100)');
    }
    if (sides < 1 || sides > 1000) {
      throw new BadRequestException('Número de caras inválido (1-1000)');
    }

    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      sum += roll;
    }

    return {
      userId,
      userName,
      formula,
      rolls,
      total: sum + modifier,
    };
  }

  async grantXp(gameId: string, userId: number, dto: GrantXpDto) {
    await this.verifyGameMaster(gameId, userId);

    if (dto.characterId) {
      const character = await this.prisma.character.findFirst({
        where: { id: dto.characterId, gameId, is_npc: false },
      });
      if (!character) {
        throw new NotFoundException('Personaje no encontrado en esta partida');
      }

      const updated = await this.prisma.character.update({
        where: { id: dto.characterId },
        data: { exp: { increment: dto.xp } },
      });

      this.gameGateway.server.to(gameId).emit('xpGranted', {
        characterId: dto.characterId,
        exp: updated.exp,
      });

      return updated;
    }

    const characters = await this.prisma.character.findMany({
      where: { gameId, is_npc: false },
    });

    const updatedCharacters = await Promise.all(
      characters.map((c) =>
        this.prisma.character.update({
          where: { id: c.id },
          data: { exp: { increment: dto.xp } },
        }),
      ),
    );

    this.gameGateway.server.to(gameId).emit('xpGrantedBulk', {
      xp: dto.xp,
      characters: updatedCharacters.map((c) => ({ id: c.id, exp: c.exp })),
    });

    return updatedCharacters;
  }

  async getChatMessages(gameId: string, userId: number) {
    await this.verifyGameAccess(gameId, userId);

    return this.prisma.chatMessage.findMany({
      where: { gameId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendChatMessage(
    gameId: string,
    userId: number,
    dto: CreateChatMessageDto,
  ) {
    await this.verifyGameAccess(gameId, userId);

    const message = await this.prisma.chatMessage.create({
      data: {
        content: dto.content,
        gameId,
        senderId: userId,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    this.gameGateway.server.to(gameId).emit('chatMessage', message);

    return message;
  }

  async addEquipment(
    gameId: string,
    characterId: number,
    userId: number,
    dto: AddEquipmentDto,
  ) {
    await this.verifyGameAccess(gameId, userId);

    const character = await this.prisma.character.findFirst({
      where: { id: characterId, gameId },
    });
    if (!character) {
      throw new NotFoundException('Personaje no encontrado en esta partida');
    }

    const equipment = (character.equipment as Array<{
      name: string;
      quantity: number;
      description?: string;
    }>) ?? [];

    const existing = equipment.find(
      (item) => item.name.toLowerCase() === dto.name.toLowerCase(),
    );

    let updatedEquipment;
    if (existing) {
      updatedEquipment = equipment.map((item) =>
        item.name.toLowerCase() === dto.name.toLowerCase()
          ? { ...item, quantity: item.quantity + dto.quantity }
          : item,
      );
    } else {
      updatedEquipment = [...equipment, { name: dto.name, quantity: dto.quantity, description: dto.description }];
    }

    const updated = await this.prisma.character.update({
      where: { id: characterId },
      data: { equipment: updatedEquipment as unknown as Prisma.InputJsonValue },
    });

    this.gameGateway.server.to(gameId).emit('equipmentUpdated', {
      characterId,
      equipment: updated.equipment,
    });

    return updated;
  }

  async removeEquipment(
    gameId: string,
    characterId: number,
    userId: number,
    dto: RemoveEquipmentDto,
  ) {
    await this.verifyGameAccess(gameId, userId);

    const character = await this.prisma.character.findFirst({
      where: { id: characterId, gameId },
    });
    if (!character) {
      throw new NotFoundException('Personaje no encontrado en esta partida');
    }

    const equipment = (character.equipment as Array<{
      name: string;
      quantity: number;
      description?: string;
    }>) ?? [];

    const existing = equipment.find(
      (item) => item.name.toLowerCase() === dto.name.toLowerCase(),
    );
    if (!existing) {
      throw new NotFoundException('No tenés ese objeto en el inventario');
    }

    const newQuantity = existing.quantity - dto.quantity;
    let updatedEquipment;
    if (newQuantity <= 0) {
      updatedEquipment = equipment.filter(
        (item) => item.name.toLowerCase() !== dto.name.toLowerCase(),
      );
    } else {
      updatedEquipment = equipment.map((item) =>
        item.name.toLowerCase() === dto.name.toLowerCase()
          ? { ...item, quantity: newQuantity }
          : item,
      );
    }

    const updated = await this.prisma.character.update({
      where: { id: characterId },
      data: { equipment: updatedEquipment as unknown as Prisma.InputJsonValue },
    });

    this.gameGateway.server.to(gameId).emit('equipmentUpdated', {
      characterId,
      equipment: updated.equipment,
    });

    return updated;
  }

  private async verifyGameAccess(gameId: string, userId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Partida no encontrada');
    }

    const isMaster = game.masterId === userId;
    if (!isMaster) {
      const character = await this.prisma.character.findFirst({
        where: { gameId, userId, is_npc: false },
      });
      if (!character) {
        throw new ForbiddenException('No tienes acceso a esta partida');
      }
    }

    return game;
  }
}
