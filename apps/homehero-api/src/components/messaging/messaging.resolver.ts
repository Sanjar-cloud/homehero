import { HttpException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MessagingGuard } from './messaging.guard';
import { MessagingService } from './messaging.service';
import { ChatMessage, Conversation, Conversations, Messages } from '../../libs/dto/messaging/messaging';
import { ConversationsInquiry, MessagesInquiry, SendMessageInput, StartConversationInput } from '../../libs/dto/messaging/messaging.input';

@Resolver()
@UseGuards(MessagingGuard)
export class MessagingResolver {
	constructor(private readonly messaging: MessagingService) {}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try { return await operation(); }
		catch (error) {
			if (error instanceof HttpException && error.getStatus() < 500) throw error;
			// Database/driver errors may contain private document values.
			throw new InternalServerErrorException('Messaging operation failed');
		}
	}

	@Mutation(() => Conversation)
	startConversation(@Args('input') input: StartConversationInput, @Context() context: any) {
		return this.execute(() => this.messaging.startConversation(context.req.messagingMemberId, input));
	}
	@Query(() => Conversations)
	getConversations(@Args('input') input: ConversationsInquiry, @Context() context: any) {
		return this.execute(() => this.messaging.getConversations(context.req.messagingMemberId, input));
	}
	@Mutation(() => ChatMessage)
	sendMessage(@Args('input') input: SendMessageInput, @Context() context: any) {
		return this.execute(() => this.messaging.sendMessage(context.req.messagingMemberId, input));
	}
	@Query(() => Messages)
	getMessages(@Args('input') input: MessagesInquiry, @Context() context: any) {
		return this.execute(() => this.messaging.getMessages(context.req.messagingMemberId, input));
	}
}
