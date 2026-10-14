import { Field, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from 'mongoose';
import { TotalCounter } from '../member/member';

@ObjectType()
export class ReviewAuthor {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberNick: string;

	@Field(() => String, { nullable: true })
	memberImage?: string | null;
}

@ObjectType()
export class AgentReview {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	authorId: ObjectId;

	@Field(() => String)
	agentId: ObjectId;

	@Field(() => String)
	text: string;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => ReviewAuthor, { nullable: true })
	authorData?: ReviewAuthor | null;
}

@ObjectType()
export class AgentReviews {
	@Field(() => [AgentReview])
	list: AgentReview[];

	@Field(() => [TotalCounter])
	metaCounter: TotalCounter[];
}
