import { MessagingModule } from '../components/messaging/messaging.module';
import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { AuthModule } from '../components/auth/auth.module';

@Module({
	imports: [AuthModule, MessagingModule],
	providers: [SocketGateway],
})
export class SocketModule {}
