import { NotificationModule } from '../components/notification/notification.module';
import { MessagingModule } from '../components/messaging/messaging.module';
import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { AuthModule } from '../components/auth/auth.module';

@Module({
	imports: [AuthModule, MessagingModule, NotificationModule],
	providers: [SocketGateway],
})
export class SocketModule {}
