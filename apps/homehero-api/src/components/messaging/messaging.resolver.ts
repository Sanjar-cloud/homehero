import { HttpException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MessagingGuard } from './messaging.guard';
import { MessagingService } from './messaging.service';
import { ChatMessage, Conversation, Conversations, Messages } from '../../libs/dto/messaging/messaging';
import { ConversationsInquiry, MessagesInquiry, SendMessageInput, StartConversationInput } from '../../libs/dto/messaging/messaging.input';

@Resolver()
@UseGuards(MessagingGuard)
export class MessagingResolver {
	constructor(private readonly messagingService: MessagingService) {}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof HttpException && error.getStatus() < 500) {
				throw error;
			}
			// Database/driver errors may contain private document values.
			throw new InternalServerErrorException('Messaging operation failed');
		}
	}

	@Mutation(() => Conversation)
	public startConversation(
		@Args('input') input: StartConversationInput,
		@Context() context: any,
	): Promise<Conversation> {
		return this.execute(() => this.messagingService.startConversation(context.req.messagingMemberId, input));
	}

	@Query(() => Conversations)
	public getConversations(
		@Args('input') input: ConversationsInquiry,
		@Context() context: any,
	): Promise<Conversations> {
		return this.execute(() => this.messagingService.getConversations(context.req.messagingMemberId, input));
	}

	@Mutation(() => ChatMessage)
	public sendMessage(
		@Args('input') input: SendMessageInput,
		@Context() context: any,
	): Promise<ChatMessage> {
		return this.execute(() => this.messagingService.sendMessage(context.req.messagingMemberId, input));
	}

	@Query(() => Messages)
	public getMessages(
		@Args('input') input: MessagesInquiry,
		@Context() context: any,
	): Promise<Messages> {
		return this.execute(() => this.messagingService.getMessages(context.req.messagingMemberId, input));
	}
}
