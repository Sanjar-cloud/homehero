import 'reflect-metadata';

jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GraphQLInputObjectType, GraphQLObjectType, printSchema } from 'graphql';
import { model, Types } from 'mongoose';
import { SupportService } from './support.service';
import { SupportResolver } from './support.resolver';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { NoticeCategory, NoticeStatus } from '../../libs/enums/notice.enum';
import { SupportRequestStatus } from '../../libs/enums/support.enum';
import { CreateSupportNoticeInput, CreateSupportRequestInput, ReplySupportRequestInput, SupportRequestsInquiry } from '../../libs/dto/support/support.input';
import NoticeSchema from '../../schemas/Notice.model';
import SupportRequestSchema from '../../schemas/SupportRequest.model';

const userId = new Types.ObjectId();
const agentId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const requestId = new Types.ObjectId();
const noticeId = new Types.ObjectId();
const page = { page: 1, limit: 10 };
const noticeInput = { noticeCategory: NoticeCategory.FAQ, noticeTitle: ' How to search? ', noticeContent: ' Use Services. ', noticeStatus: NoticeStatus.HOLD };
const requestInput = { subject: ' Need help ', content: ' Please help. ' };
const OfflineRequest = model('OfflineSupportRequest', SupportRequestSchema);
const OfflineNotice = model('OfflineSupportNotice', NoticeSchema);

function query(value: unknown) {
	return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) };
}

function harness() {
	const accounts = new Map([
		[String(userId), { _id: userId, memberType: MemberType.USER, memberStatus: MemberStatus.ACTIVE }],
		[String(agentId), { _id: agentId, memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE }],
		[String(adminId), { _id: adminId, memberType: MemberType.ADMIN, memberStatus: MemberStatus.ACTIVE }],
	]);
	const members = { findOne: jest.fn((match) => query(accounts.get(String(match._id)) ?? null)) };
	const notices = {
		create: jest.fn(async (data) => ({ _id: noticeId, ...data })),
		findOneAndUpdate: jest.fn(() => query({ _id: noticeId })),
		aggregate: jest.fn((_pipeline: unknown[]) => query([{ list: [], metaCounter: [] }])),
	};
	let record: any = { _id: requestId, memberId: userId, status: SupportRequestStatus.OPEN, reply: null };
	const requests = {
		create: jest.fn(async (data) => ({ _id: requestId, ...data })),
		aggregate: jest.fn((_pipeline: unknown[]) => query([{ list: [], metaCounter: [] }])),
		findOneAndUpdate: jest.fn((match, update) => ({
			lean: jest.fn().mockReturnThis(),
			exec: jest.fn(async () => {
				if (!record || String(match._id) !== String(record._id) || match.status !== record.status || match.reply !== record.reply) return null;
				record = { ...record, ...update.$set };
				return { ...record };
			}),
		})),
	};
	return { service: new SupportService(notices as any, requests as any, members as any), accounts, notices, requests, members };
}

describe('Support (offline)', () => {
	it('creates only allowlisted English/optional translation fields with the authenticated admin', async () => {
		const { service, notices } = harness();
		await service.createSupportNotice(adminId, {
			...noticeInput,
			translations: { kr: { title: ' 이용 방법 ', content: ' 서비스를 검색하세요. ' } },
			memberId: otherId,
			noticeCategoryExtra: 'unsupported',
			createdAt: 'spoofed',
		} as any);
		expect(notices.create).toHaveBeenCalledWith({
			memberId: adminId, noticeCategory: NoticeCategory.FAQ, noticeStatus: NoticeStatus.HOLD,
			noticeTitle: 'How to search?', noticeContent: 'Use Services.',
			translations: { kr: { title: '이용 방법', content: '서비스를 검색하세요.' } },
		});
	});

	it('defaults new notices to HOLD and accepts English without translations', async () => {
		const { service, notices } = harness();
		await service.createSupportNotice(adminId, { ...noticeInput, noticeStatus: undefined } as any);
		expect(notices.create.mock.calls[0][0]).toMatchObject({ noticeStatus: NoticeStatus.HOLD, translations: null });
	});

	it.each([MemberType.USER, MemberType.AGENT])('rejects %s content management and admin reads', async (role) => {
		const { service, notices, requests } = harness();
		const id = role === MemberType.USER ? userId : agentId;
		await expect(service.createSupportNotice(id, noticeInput)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.updateSupportNotice(id, { ...noticeInput, _id: String(noticeId) })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.getSupportNoticesByAdmin(id, { ...page, noticeCategory: NoticeCategory.FAQ })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.getSupportRequestsByAdmin(id, page)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.replySupportRequest(id, { _id: String(requestId), reply: 'Answer' })).rejects.toBeInstanceOf(ForbiddenException);
		expect(notices.create).not.toHaveBeenCalled();
		expect(requests.aggregate).not.toHaveBeenCalled();
	});

	it('rejects expired database permissions even when a caller has an old JWT identity', async () => {
		const { service, accounts, requests } = harness();
		for (const id of [userId, agentId, adminId]) accounts.get(String(id))!.memberStatus = MemberStatus.BLOCK;
		await expect(service.createSupportRequest(userId, requestInput)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.getMySupportRequests(agentId, page)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.replySupportRequest(adminId, { _id: String(requestId), reply: 'Answer' })).rejects.toBeInstanceOf(ForbiddenException);
		accounts.delete(String(adminId));
		await expect(service.getSupportRequestsByAdmin(adminId, page)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.getMySupportRequests(null, page)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(requests.create).not.toHaveBeenCalled();
	});

	it('rejects invalid content kinds, deletion statuses, malformed IDs and incomplete translations', async () => {
		const { service, notices } = harness();
		for (const change of [
			{ noticeCategory: NoticeCategory.TERMS }, { noticeStatus: NoticeStatus.DELETE },
			{ noticeTitle: '  ' }, { noticeContent: '' },
			{ translations: { ru: { title: 'Title' } } }, { translations: [] },
		]) await expect(service.createSupportNotice(adminId, { ...noticeInput, ...change } as any)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.updateSupportNotice(adminId, { ...noticeInput, _id: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
		expect(notices.create).not.toHaveBeenCalled();
	});

	it('updates published/draft content only; keeps category/author immutable and translations unless supplied', async () => {
		const { service, notices } = harness();
		await service.updateSupportNotice(adminId, { ...noticeInput, _id: String(noticeId), noticeStatus: NoticeStatus.ACTIVE, memberId: otherId } as any);
		const [match, update, options] = notices.findOneAndUpdate.mock.calls[0] as any;
		expect(match.noticeCategory.$in).toEqual([NoticeCategory.FAQ, NoticeCategory.ANNOUNCEMENT]);
		expect(match.noticeStatus.$in).toEqual([NoticeStatus.HOLD, NoticeStatus.ACTIVE]);
		expect(update.$set).toEqual({ noticeTitle: 'How to search?', noticeContent: 'Use Services.', noticeStatus: NoticeStatus.ACTIVE });
		expect(options).toEqual({ new: true, runValidators: true });
		await service.updateSupportNotice(adminId, { ...noticeInput, _id: String(noticeId), translations: null });
		expect((notices.findOneAndUpdate.mock.calls[1] as any)[1].$set.translations).toBeNull();
	});

	it('always limits public reads to ACTIVE; escapes literal search and returns stable pagination', async () => {
		const { service, notices } = harness();
		expect(await service.getSupportNotices({ page: 2, limit: 10, noticeCategory: NoticeCategory.FAQ, text: ' [help].* ', noticeStatus: NoticeStatus.HOLD } as any))
			.toEqual({ list: [], metaCounter: [{ total: 0 }] });
		const pipeline = notices.aggregate.mock.calls[0][0] as any;
		expect(pipeline[0].$match.noticeStatus).toEqual({ $in: [NoticeStatus.ACTIVE] });
		expect(pipeline[0].$match.$or[0].noticeTitle.$regex).toBe('\\[help\\]\\.\\*');
		expect(pipeline[1]).toEqual({ $sort: { createdAt: -1, _id: -1 } });
		expect(pipeline[2].$facet.list[0]).toEqual({ $skip: 10 });
		expect(pipeline[2].$facet.list[2].$project).not.toHaveProperty('memberId');
	});

	it('allows admin reads of both HOLD/ACTIVE and excludes legacy TERMS/INQUIRY categories', async () => {
		const { service, notices } = harness();
		await service.getSupportNoticesByAdmin(adminId, { ...page, noticeCategory: NoticeCategory.ANNOUNCEMENT });
		expect((notices.aggregate.mock.calls[0][0] as any)[0].$match.noticeStatus.$in).toEqual([NoticeStatus.HOLD, NoticeStatus.ACTIVE]);
		await expect(service.getSupportNotices({ ...page, noticeCategory: NoticeCategory.INQUIRY })).rejects.toBeInstanceOf(BadRequestException);
	});

	it.each([userId, agentId])('creates OPEN requests for the real USER/AGENT owner only', async (id) => {
		const { service, requests } = harness();
		await service.createSupportRequest(id, { ...requestInput, memberId: otherId, status: 'ANSWERED', reply: 'spoofed' } as any);
		expect(requests.create).toHaveBeenCalledWith({ memberId: id, subject: 'Need help', content: 'Please help.', status: SupportRequestStatus.OPEN });
		await expect(service.createSupportRequest(adminId, requestInput)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('enforces private ownership in the database match and projects only minimal member data', async () => {
		const { service, requests } = harness();
		await service.getMySupportRequests(userId, { ...page, memberId: otherId } as any);
		const pipeline = requests.aggregate.mock.calls[0][0] as any;
		expect(pipeline[0].$match).toEqual({ memberId: userId });
		expect(pipeline[2].$facet.list[2].$lookup.pipeline[1].$project).toEqual({ _id: 1, memberNick: 1, memberType: 1 });
		await service.getMySupportRequests(agentId, { ...page, status: SupportRequestStatus.ANSWERED });
		expect((requests.aggregate.mock.calls[1][0] as any)[0].$match).toEqual({ memberId: agentId, status: SupportRequestStatus.ANSWERED });
	});

	it('defaults admin requests to OPEN; the filtered total is the unanswered counter', async () => {
		const { service, requests } = harness();
		requests.aggregate.mockImplementation(() => query([{ list: [], metaCounter: [{ total: 7 }] }]));
		const result = await service.getSupportRequestsByAdmin(adminId, page);
		expect(result.metaCounter).toEqual([{ total: 7 }]);
		expect((requests.aggregate.mock.calls[0][0] as any)[0].$match).toEqual({ status: SupportRequestStatus.OPEN });
		await service.getSupportRequestsByAdmin(adminId, { ...page, status: SupportRequestStatus.ANSWERED });
		expect((requests.aggregate.mock.calls[1][0] as any)[0].$match.status).toBe(SupportRequestStatus.ANSWERED);
	});

	it('atomically permits one reply and sets the real admin and server date', async () => {
		const { service, requests } = harness();
		const results = await Promise.allSettled([
			service.replySupportRequest(adminId, { _id: String(requestId), reply: ' First answer ' }),
			service.replySupportRequest(adminId, { _id: String(requestId), reply: ' Second answer ' }),
		]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
		expect(failure.reason).toBeInstanceOf(ConflictException);
		const [match, update] = requests.findOneAndUpdate.mock.calls[0];
		expect(match).toEqual({ _id: requestId, status: SupportRequestStatus.OPEN, reply: null });
		expect(update.$set).toMatchObject({ reply: 'First answer', adminId, status: SupportRequestStatus.ANSWERED });
		expect(update.$set.repliedAt).toBeInstanceOf(Date);
	});

	it('rejects invalid pagination, unknown statuses and validation boundaries before writes', async () => {
		const { service, requests } = harness();
		for (const change of [{ page: 0 }, { page: 1.5 }, { limit: 51 }, { limit: 0 }, { status: 'CLOSED' }]) {
			await expect(service.getMySupportRequests(userId, { ...page, ...change } as any)).rejects.toBeInstanceOf(BadRequestException);
		}
		for (const change of [{ subject: 'ab' }, { subject: 'x'.repeat(101) }, { content: ' ' }, { content: 'x'.repeat(2001) }]) {
			await expect(service.createSupportRequest(userId, { ...requestInput, ...change })).rejects.toBeInstanceOf(BadRequestException);
		}
		await expect(service.replySupportRequest(adminId, { _id: String(requestId), reply: ' ' })).rejects.toBeInstanceOf(BadRequestException);
		expect(requests.create).not.toHaveBeenCalled();
		expect(requests.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('validates schemas without a database connection and keeps existing Notice fields/enums', () => {
		const request = new OfflineRequest({ memberId: userId, subject: ' Need help ', content: ' Text ', closedAt: new Date() });
		expect(request.validateSync()).toBeUndefined();
		expect(request.status).toBe('OPEN');
		expect(request.subject).toBe('Need help');
		expect(request.toObject()).not.toHaveProperty('closedAt');
		expect(OfflineRequest.db.readyState).toBe(0);
		expect(new OfflineRequest({ memberId: userId, subject: 'ok', content: ' ' }).validateSync()).toBeDefined();
		const notice = new OfflineNotice({ noticeCategory: NoticeCategory.FAQ, noticeTitle: 'Legacy', noticeContent: 'English', memberId: adminId });
		expect(notice.validateSync()).toBeUndefined();
		expect(notice.noticeStatus).toBe(NoticeStatus.ACTIVE);
		expect(NoticeSchema.get('collection')).toBe('notices');
		expect(Object.values(NoticeCategory)).toEqual(expect.arrayContaining(['FAQ', 'TERMS', 'INQUIRY', 'ANNOUNCEMENT']));
	});

	it('validates nested translation pairs and input trimming through existing DTO tools', async () => {
		const request = plainToInstance(CreateSupportRequestInput, { subject: ' abc ', content: ' text ' });
		expect(await validate(request)).toEqual([]);
		expect(request.subject).toBe('abc');
		const valid = plainToInstance(CreateSupportNoticeInput, { ...noticeInput, translations: { ru: { title: 'Title', content: 'Text' } } });
		expect(await validate(valid)).toEqual([]);
		const invalid = plainToInstance(CreateSupportNoticeInput, { ...noticeInput, translations: { ru: { title: 'Title' } } });
		expect((await validate(invalid)).length).toBeGreaterThan(0);
		expect((await validate(plainToInstance(SupportRequestsInquiry, { page: 0, limit: 51 }))).length).toBe(2);
		expect((await validate(plainToInstance(ReplySupportRequestInput, { _id: 'bad', reply: '' }))).length).toBe(2);
	});

	it('builds exactly eight code-first operations offline with no spoofable owner or delete/close API', async () => {
		const module = await Test.createTestingModule({ imports: [GraphQLSchemaBuilderModule] }).compile();
		try {
			const schema = await module.get(GraphQLSchemaFactory).create([SupportResolver]);
			expect(Object.keys(schema.getQueryType()!.getFields())).toHaveLength(4);
			expect(Object.keys(schema.getMutationType()!.getFields())).toHaveLength(4);
			expect(Object.keys((schema.getType('CreateSupportRequestInput') as GraphQLInputObjectType).getFields())).toEqual(['subject', 'content']);
			expect(Object.keys((schema.getType('ReplySupportRequestInput') as GraphQLInputObjectType).getFields())).toEqual(['_id', 'reply']);
			expect((schema.getType('UpdateSupportNoticeInput') as GraphQLInputObjectType).getFields()).not.toHaveProperty('noticeCategory');
			expect(Object.keys((schema.getType('SupportMember') as GraphQLObjectType).getFields())).toEqual(['_id', 'memberNick', 'memberType']);
			expect(printSchema(schema)).not.toMatch(/closeSupport|deleteSupport|SupportNotification|CLOSED/);
		} finally { await module.close(); }
	});

	it('guards private operations and hides raw server/database error details', async () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, SupportResolver.prototype.getSupportNotices)).toBeUndefined();
		for (const name of ['createSupportRequest', 'getMySupportRequests']) {
			expect(Reflect.getMetadata(GUARDS_METADATA, SupportResolver.prototype[name])).toContain(AuthGuard);
		}
		for (const name of ['getSupportNoticesByAdmin', 'createSupportNotice', 'updateSupportNotice', 'getSupportRequestsByAdmin', 'replySupportRequest']) {
			expect(Reflect.getMetadata(GUARDS_METADATA, SupportResolver.prototype[name])).toContain(RolesGuard);
		}
		const resolver = new SupportResolver({ getSupportNotices: jest.fn().mockRejectedValue(new Error('private database detail')) } as any);
		await expect(resolver.getSupportNotices({ ...page, noticeCategory: NoticeCategory.FAQ })).rejects.toThrow('Support operation failed');
		const invalid = new BadRequestException('Invalid support pagination');
		const badResolver = new SupportResolver({ getSupportNotices: jest.fn().mockRejectedValue(invalid) } as any);
		await expect(badResolver.getSupportNotices({ ...page, noticeCategory: NoticeCategory.FAQ })).rejects.toBe(invalid);
	});
});
