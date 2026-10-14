import { HttpException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from 'mongoose';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AgentReview, AgentReviews } from '../../libs/dto/review/review';
import { AgentReviewsInquiry, CreateAgentReviewInput } from '../../libs/dto/review/review.input';
import { ReviewService } from './review.service';

@Resolver()
export class ReviewResolver {
	constructor(private readonly reviewService: ReviewService) {}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try { return await operation(); }
		catch (error) {
			if (error instanceof HttpException && error.getStatus() < 500) throw error;
			throw new InternalServerErrorException('Review operation failed');
		}
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AgentReview)
	public createAgentReview(@Args('input') input: CreateAgentReviewInput, @AuthMember('_id') memberId: ObjectId): Promise<AgentReview> {
		return this.execute(() => this.reviewService.createAgentReview(memberId, input));
	}

	@Query(() => AgentReviews)
	public getAgentReviews(@Args('input') input: AgentReviewsInquiry): Promise<AgentReviews> {
		return this.execute(() => this.reviewService.getAgentReviews(input));
	}
}
