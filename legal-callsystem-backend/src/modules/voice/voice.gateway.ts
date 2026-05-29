import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { VoiceGatewayService } from './voice-gateway.service';

@WebSocketGateway({ namespace: '/voice', cors: { origin: '*' } })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly voiceGateway: VoiceGatewayService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`WebSocket 连接: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket 断开: ${client.id}`);
    const rooms = Array.from(client.rooms).filter(r => r !== client.id);
    for (const room of rooms) {
      this.voiceGateway.endConversation(room);
    }
  }

  @SubscribeMessage('join-call')
  async handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; tenantId: string; customerId: string; scriptId?: string },
  ) {
    client.join(data.callId);
    const sessionId = await this.voiceGateway.startConversation(
      data.callId,
      data.customerId,
      data.tenantId,
      data.scriptId,
    );
    this.logger.log(`通话加入: ${data.callId}, session: ${sessionId}`);
    return { event: 'joined', data: { callId: data.callId, sessionId } };
  }

  @SubscribeMessage('audio-data')
  async handleAudioData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; audio: string },
  ) {
    try {
      const audioBuffer = Buffer.from(data.audio, 'base64');
      const result = await this.voiceGateway.processRound(data.callId, audioBuffer);

      const fs = await import('fs');
      const audioBase64 = fs.readFileSync(result.audioUrl).toString('base64');

      this.server.to(data.callId).emit('ai-reply', {
        text: result.reply,
        audio: audioBase64,
        userText: result.text,
        duration: result.duration,
      });

      return { event: 'ack' };
    } catch (error) {
      this.logger.error(`音频处理失败: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('interrupt')
  handleInterrupt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    this.logger.log(`打断请求: ${data.callId}`);
    this.server.to(data.callId).emit('interrupted', { callId: data.callId });
  }

  @SubscribeMessage('end-call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    this.logger.log(`通话结束: ${data.callId}`);
    this.voiceGateway.endConversation(data.callId);
    this.server.to(data.callId).emit('call-ended', { callId: data.callId });
  }
}
