import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ConversationSchema from '../../schemas/Conversation.model';
import MessageSchema from '../../schemas/Message.model';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import { ServiceModule } from '../service/service.module';
import { MessagingService } from './messaging.service';
import { MessagingResolver } from './messaging.resolver';
import { MessagingGuard } from './messaging.guard';

@Module({
	imports: [AuthModule, ServiceModule, MongooseModule.forFeature([
		{ name: 'Conversation', schema: ConversationSchema },
		{ name: 'Message', schema: MessageSchema },
		{ name: 'Member', schema: MemberSchema },
	])],
	providers: [MessagingService, MessagingResolver, MessagingGuard],
	exports: [MessagingService],
})
export class MessagingModule {}
