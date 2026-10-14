import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Member } from '../../libs/dto/member/member';
import { AgentReview, AgentReviews } from '../../libs/dto/review/review';
import { AgentReviewsInquiry, CreateAgentReviewInput } from '../../libs/dto/review/review.input';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';

@Injectable()
export class ReviewService {
	constructor(
		@InjectModel('Review') private readonly reviewModel: Model<AgentReview>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

	private id(value: unknown): Types.ObjectId {
		const text = value instanceof Types.ObjectId ? value.toHexString() : value;
		if (typeof text !== 'string' || !isMongoId(text)) {
			throw new BadRequestException('Invalid review ID');
		}
		return new Types.ObjectId(text);
	}

	private async activeAgent(agentId: Types.ObjectId): Promise<void> {
		const agent = await this.memberModel
			.findOne({ _id: agentId, memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE })
			.select('_id')
			.lean()
			.exec();
		if (!agent) throw new NotFoundException('Agent unavailable');
	}

	public async createAgentReview(memberId: unknown, input: CreateAgentReviewInput): Promise<AgentReview> {
		if (!memberId) throw new UnauthorizedException('Authentication required');
		const authorId = this.id(memberId);
		const agentId = this.id(input.agentId);
		if (authorId.equals(agentId)) throw new ForbiddenException('Self-review is not allowed');
		const author = await this.memberModel
			.findOne({ _id: authorId })
			.select('_id memberType memberStatus memberNick memberImage')
			.lean()
			.exec();
		if (!author || author.memberType !== MemberType.USER || author.memberStatus !== MemberStatus.ACTIVE) {
			throw new ForbiddenException('Only active customers can write reviews');
		}
		await this.activeAgent(agentId);
		if (typeof input.text !== 'string') throw new BadRequestException('Invalid review text');
		const text = input.text.trim();
		if (text.length < 1 || text.length > 2000) throw new BadRequestException('Review text must contain 1–2000 characters');
		// Construct the document explicitly: client author, dates and extra fields are never stored.
		const review = await this.reviewModel.create({ authorId, agentId, text });
		return {
			_id: review._id,
			authorId: review.authorId,
			agentId: review.agentId,
			text: review.text,
			createdAt: review.createdAt,
			authorData: { _id: author._id, memberNick: author.memberNick, memberImage: author.memberImage },
		};
	}

	public async getAgentReviews(input: AgentReviewsInquiry): Promise<AgentReviews> {
		const agentId = this.id(input.agentId);
		if (
			!Number.isInteger(input.page) || input.page < 1 || input.page > 2147483647 ||
			!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50
		) {
			throw new BadRequestException('Invalid review pagination');
		}
		await this.activeAgent(agentId);
		const result = await this.reviewModel.aggregate<AgentReviews>([
			{ $match: { agentId } },
			{ $sort: { createdAt: -1, _id: -1 } },
			{
				$facet: {
					list: [
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						{
							$lookup: {
								from: 'members',
								let: { authorId: '$authorId' },
								pipeline: [
									{ $match: { $expr: { $eq: ['$_id', '$$authorId'] } } },
									{ $project: { _id: 1, memberNick: 1, memberImage: 1 } },
								],
								as: 'authorData',
							},
						},
						{ $unwind: { path: '$authorData', preserveNullAndEmptyArrays: true } },
						{ $project: { _id: 1, authorId: 1, agentId: 1, text: 1, createdAt: 1, authorData: 1 } },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]).exec();
		const data = result[0] ?? { list: [], metaCounter: [] };
		return { list: data.list, metaCounter: data.metaCounter.length ? data.metaCounter : [{ total: 0 }] };
	}
}
