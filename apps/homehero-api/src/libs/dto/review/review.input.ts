import { Transform } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsMongoId, IsString, Length, Max, Min } from 'class-validator';

@InputType()
export class CreateAgentReviewInput {
	@IsMongoId()
	@Field(() => String)
	agentId: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 2000)
	@Field(() => String)
	text: string;
}

@InputType()
export class AgentReviewsInquiry {
	@IsMongoId()
	@Field(() => String)
	agentId: string;

	@IsInt()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsInt()
	@Min(1)
	@Max(50)
	@Field(() => Int)
	limit: number;
}
