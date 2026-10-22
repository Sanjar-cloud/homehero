import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import NotificationSchema from '../../schemas/Notification.model';
import MemberSchema from '../../schemas/Member.model';
import ConversationSchema from '../../schemas/Conversation.model';
import MessageSchema from '../../schemas/Message.model';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NotificationGuard } from './notification.guard';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Conversation', schema: ConversationSchema },
			{ name: 'Message', schema: MessageSchema },
		]),
	],
	providers: [NotificationService, NotificationResolver, NotificationGuard],
	exports: [NotificationService],
})
export class NotificationModule {}
