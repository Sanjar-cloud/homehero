import 'reflect-metadata';

jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { model, Types } from 'mongoose';
import { Test } from '@nestjs/testing';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { GraphQLInputObjectType, GraphQLObjectType } from 'graphql';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewService } from './review.service';
import { ReviewResolver } from './review.resolver';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AgentReviewsInquiry, CreateAgentReviewInput } from '../../libs/dto/review/review.input';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import ReviewSchema from '../../schemas/Review.model';

const userId = new Types.ObjectId();
const agentId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const reviewId = new Types.ObjectId();
const OfflineReview = model('OfflineAgentReview', ReviewSchema);
const input = { agentId: agentId.toHexString(), text: '  Real feedback  ' };

function query(value: unknown) {
	return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) };
}

function harness() {
	const accounts = new Map([
		[userId.toHexString(), { _id: userId, memberType: MemberType.USER, memberStatus: MemberStatus.ACTIVE, memberNick: 'Customer', memberImage: 'uploads/member/example.png' }],
		[agentId.toHexString(), { _id: agentId, memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE, memberNick: 'Agent', memberImage: '' }],
	]);
	const members = { findOne: jest.fn((match) => {
		const value = accounts.get(String(match._id));
		return query(value && (!match.memberType || value.memberType === match.memberType) && (!match.memberStatus || value.memberStatus === match.memberStatus) ? value : null);
	}) };
	const reviews = {
		create: jest.fn(async (data) => ({ ...data, _id: reviewId, createdAt: new Date('2026-10-15T00:00:00Z') })),
		aggregate: jest.fn((_pipeline: unknown[]) => query([{ list: [], metaCounter: [] }])),
	};
	return { service: new ReviewService(reviews as any, members as any), accounts, members, reviews };
}

describe('Agent Reviews (offline)', () => {
	it('stores authenticated author, target, trimmed text and server date only', async () => {
		const { service, reviews } = harness();
		const result = await service.createAgentReview(userId, { ...input, authorId: otherId, createdAt: 'spoofed', rating: 5 } as any);
		expect(reviews.create).toHaveBeenCalledWith({ authorId: userId, agentId, text: 'Real feedback' });
		expect(result.createdAt).toBeInstanceOf(Date);
		expect(Object.keys(result.authorData!)).toEqual(['_id', 'memberNick', 'memberImage']);
	});

	it('allows multiple reviews by the same USER for the same AGENT', async () => {
		const { service, reviews } = harness();
		await service.createAgentReview(userId, input);
		await service.createAgentReview(userId, input);
		expect(reviews.create).toHaveBeenCalledTimes(2);
		expect(ReviewSchema.indexes().some(([, options]) => options.unique)).toBe(false);
	});

	it('rejects guests without attempting a database write', async () => {
		const { service, reviews } = harness();
		await expect(service.createAgentReview(null, input)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it.each([MemberType.AGENT, MemberType.ADMIN])('checks current database role and rejects %s authors', async (role) => {
		const { service, accounts, reviews } = harness();
		accounts.get(String(userId))!.memberType = role;
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(ForbiddenException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it('rejects blocked, deleted or missing authors', async () => {
		const { service, accounts, reviews } = harness();
		accounts.get(String(userId))!.memberStatus = MemberStatus.BLOCK;
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(ForbiddenException);
		accounts.get(String(userId))!.memberStatus = MemberStatus.DELETE;
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(ForbiddenException);
		accounts.delete(String(userId));
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(ForbiddenException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it('rejects self-review', async () => {
		const { service, reviews } = harness();
		await expect(service.createAgentReview(userId, { ...input, agentId: String(userId) })).rejects.toBeInstanceOf(ForbiddenException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it('rejects non-AGENT, inactive and missing targets for both reads and writes', async () => {
		const { service, accounts, reviews } = harness();
		accounts.get(String(agentId))!.memberType = MemberType.USER;
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(NotFoundException);
		accounts.get(String(agentId))!.memberType = MemberType.AGENT;
		accounts.get(String(agentId))!.memberStatus = MemberStatus.BLOCK;
		await expect(service.getAgentReviews({ agentId: String(agentId), page: 1, limit: 6 })).rejects.toBeInstanceOf(NotFoundException);
		accounts.delete(String(agentId));
		await expect(service.createAgentReview(userId, input)).rejects.toBeInstanceOf(NotFoundException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it.each(['', '   ', 'x'.repeat(2001), null])('rejects invalid review text', async (text) => {
		const { service, reviews } = harness();
		await expect(service.createAgentReview(userId, { ...input, text } as any)).rejects.toBeInstanceOf(BadRequestException);
		expect(reviews.create).not.toHaveBeenCalled();
	});

	it('accepts 1 and 2000 character trimmed boundaries', async () => {
		const { service } = harness();
		expect((await service.createAgentReview(userId, { ...input, text: ' x ' })).text).toBe('x');
		expect((await service.createAgentReview(userId, { ...input, text: 'x'.repeat(2000) })).text.length).toBe(2000);
	});

	it('validates IDs and pagination in the service', async () => {
		const { service, reviews } = harness();
		await expect(service.createAgentReview('invalid', input)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.getAgentReviews({ agentId: 'invalid', page: 1, limit: 6 })).rejects.toBeInstanceOf(BadRequestException);
		for (const [page, limit] of [[0, 6], [1.5, 6], [1, 0], [1, 51], [1, 1.5], [2147483648, 6]]) {
			await expect(service.getAgentReviews({ agentId: String(agentId), page, limit })).rejects.toBeInstanceOf(BadRequestException);
		}
		expect(reviews.aggregate).not.toHaveBeenCalled();
	});

	it('uses target filtering, stable pagination and a minimal nullable author projection', async () => {
		const { service, reviews } = harness();
		const missingAuthorReview = { _id: reviewId, authorId: otherId, agentId, text: 'Retained', createdAt: new Date(), authorData: null };
		reviews.aggregate.mockImplementation(() => query([{ list: [missingAuthorReview], metaCounter: [{ total: 7 }] }]));
		const result = await service.getAgentReviews({ agentId: String(agentId), page: 2, limit: 6 });
		expect(result.list[0]).toEqual(missingAuthorReview);
		expect(result.metaCounter).toEqual([{ total: 7 }]);
		const pipeline = reviews.aggregate.mock.calls[0][0] as any;
		expect(pipeline[0]).toEqual({ $match: { agentId } });
		expect(pipeline[1]).toEqual({ $sort: { createdAt: -1, _id: -1 } });
		const list = pipeline[2].$facet.list;
		expect(list[0]).toEqual({ $skip: 6 });
		expect(list[1]).toEqual({ $limit: 6 });
		expect(list[2].$lookup.pipeline[1]).toEqual({ $project: { _id: 1, memberNick: 1, memberImage: 1 } });
		expect(list[3].$unwind.preserveNullAndEmptyArrays).toBe(true);
		expect(list[4].$project).not.toHaveProperty('rating');
	});

	it('returns zero total for an empty result', async () => {
		const { service } = harness();
		expect(await service.getAgentReviews({ agentId: String(agentId), page: 1, limit: 6 })).toEqual({ list: [], metaCounter: [{ total: 0 }] });
	});

	it('validates the Mongoose schema offline and keeps Reviews separate from Comments', async () => {
		const document = new OfflineReview({ authorId: userId, agentId, text: ' Review ', rating: 5, commentGroup: 'SERVICE' });
		expect(document.validateSync()).toBeUndefined();
		expect(document.text).toBe('Review');
		expect(document.toObject()).not.toHaveProperty('rating');
		expect(document.toObject()).not.toHaveProperty('commentGroup');
		expect(ReviewSchema.get('collection')).toBe('reviews');
		expect(new OfflineReview({ authorId: userId, agentId, text: ' ' }).validateSync()).toBeDefined();
	});

	it('validates DTO fields and does not expose client author/date/rating inputs', async () => {
		const create = Object.assign(new CreateAgentReviewInput(), { agentId: 'invalid', text: '' });
		expect((await validate(create)).length).toBeGreaterThan(0);
		const inquiry = Object.assign(new AgentReviewsInquiry(), { agentId: String(agentId), page: 0, limit: 51 });
		expect((await validate(inquiry)).length).toBe(2);
	});

	it('builds the real code-first GraphQL schema offline with minimal public fields', async () => {
		const module = await Test.createTestingModule({ imports: [GraphQLSchemaBuilderModule] }).compile();
		try {
			const schema = await module.get(GraphQLSchemaFactory).create([ReviewResolver]);
			expect(schema.getQueryType()!.getFields()).toHaveProperty('getAgentReviews');
			expect(schema.getMutationType()!.getFields()).toHaveProperty('createAgentReview');
			const inputType = schema.getType('CreateAgentReviewInput') as GraphQLInputObjectType;
			expect(Object.keys(inputType.getFields())).toEqual(['agentId', 'text']);
			const authorType = schema.getType('ReviewAuthor') as GraphQLObjectType;
			expect(Object.keys(authorType.getFields())).toEqual(['_id', 'memberNick', 'memberImage']);
			expect((schema.getType('AgentReview') as GraphQLObjectType).getFields()).not.toHaveProperty('rating');
		} finally { await module.close(); }
	});

	it('trims DTO text before validating the length boundary', async () => {
		const dto = plainToInstance(CreateAgentReviewInput, { agentId: String(agentId), text: ' ' + 'x'.repeat(2000) + ' ' });
		expect(await validate(dto)).toEqual([]);
		expect(dto.text.length).toBe(2000);
	});

	it('guards only create and hides raw database errors', async () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, ReviewResolver.prototype.createAgentReview)).toContain(AuthGuard);
		expect(Reflect.getMetadata(GUARDS_METADATA, ReviewResolver.prototype.getAgentReviews)).toBeUndefined();
		const mockService = { createAgentReview: jest.fn().mockRejectedValue(new Error('raw private database error')) };
		const resolver = new ReviewResolver(mockService as any);
		await expect(resolver.createAgentReview(input, userId as any)).rejects.toThrow('Review operation failed');
	});
});
