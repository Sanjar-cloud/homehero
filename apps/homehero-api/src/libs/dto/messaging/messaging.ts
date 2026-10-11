import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { TotalCounter } from '../member/member';

@ObjectType()
export class ConversationParticipant {
	@Field(() => String)
	_id: Types.ObjectId;
	@Field(() => String)
	memberNick: string;
	@Field(() => String)
	memberImage: string;
}

@ObjectType()
export class MessageServiceContext {
	@Field(() => String)
	serviceId: Types.ObjectId;
	@Field(() => String)
	serviceTitle: string;
}

@ObjectType('Message')
export class ChatMessage {
	@Field(() => String)
	_id: Types.ObjectId;
	@Field(() => String)
	conversationId: Types.ObjectId;
	@Field(() => String)
	senderId: Types.ObjectId;
	@Field(() => String)
	text: string;
	@Field(() => MessageServiceContext, { nullable: true })
	serviceContext?: MessageServiceContext | null;
	@Field(() => Date)
	createdAt: Date;
}

@ObjectType()
export class Conversation {
	@Field(() => String)
	_id: Types.ObjectId;
	@Field(() => String)
	userId: Types.ObjectId;
	@Field(() => String)
	agentId: Types.ObjectId;
	@Field(() => ConversationParticipant, { nullable: true })
	userData?: ConversationParticipant | null;
	@Field(() => ConversationParticipant, { nullable: true })
	agentData?: ConversationParticipant | null;
	@Field(() => ChatMessage, { nullable: true })
	lastMessage?: ChatMessage | null;
	@Field(() => Date)
	activityAt: Date;
	@Field(() => Date)
	createdAt: Date;
	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Conversations {
	@Field(() => [Conversation])
	list: Conversation[];
	@Field(() => [TotalCounter])
	metaCounter: TotalCounter[];
}

@ObjectType()
export class Messages {
	@Field(() => [ChatMessage])
	list: ChatMessage[];
	@Field(() => [TotalCounter])
	metaCounter: TotalCounter[];
}
