import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: 'http://localhost:3001' } })
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  @SubscribeMessage('joinGameRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() gameId: string,
  ) {
    await client.join(gameId);
    console.log(`Cliente ${client.id} se unió a la sala ${gameId}`);
  }
}
