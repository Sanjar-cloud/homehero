import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Length, Max, Min } from 'class-validator';

@InputType()
export class StartConversationInput {
	@IsMongoId()
	@Field(() => String)
	serviceId: string;
}

@InputType()
export class ConversationsInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int)
	limit: number;
}

@InputType()
export class MessagesInquiry extends ConversationsInquiry {
	@IsMongoId()
	@Field(() => String)
	conversationId: string;
}

@InputType()
export class SendMessageInput {
	@IsMongoId()
	@Field(() => String)
	conversationId: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 2000)
	@Field(() => String)
	text: string;

	@IsOptional()
	@IsMongoId()
	@Field(() => String, { nullable: true })
	serviceId?: string;
}
