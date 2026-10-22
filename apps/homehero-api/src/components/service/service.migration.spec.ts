import 'reflect-metadata';

// Image naming is unrelated to the migration and UUID is ESM-only in the installed version.
jest.mock('uuid', () => ({ v4: jest.fn(() => 'offline-image') }));

import { Test } from '@nestjs/testing';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GraphQLObjectType, GraphQLInputObjectType, parse, validate } from 'graphql';
import { model, Types } from 'mongoose';
import ServiceSchema from '../../schemas/Service.model';
import MemberSchema from '../../schemas/Member.model';
import NotificationSchema from '../../schemas/Notification.model';
import { ServiceCategory, ServiceLocation, ServiceStatus } from '../../libs/enums/service.enum';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { LikeGroup } from '../../libs/enums/like.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { CommentGroup } from '../../libs/enums/comment.enum';
import { NotificationGroup } from '../../libs/enums/notification.enum';
import { ServiceInput, ServicesInquiry, AgentServicesInquiry, AllServicesInquiry, OrdinaryInquiry } from '../../libs/dto/service/service.input';
import { ServiceUpdate } from '../../libs/dto/service/service.update';
import { Member } from '../../libs/dto/member/member';
import { ServiceResolver } from './service.resolver';
import { ServiceService } from './service.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { LikeService } from '../like/like.service';
import { ViewService } from '../view/view.service';
import { CommentService } from '../comment/comment.service';
import { lookupServiceProvider, serviceProviderProjection } from '../../libs/config';

const memberId = new Types.ObjectId();
const serviceId = new Types.ObjectId();
const validInput = {
	serviceCategory: ServiceCategory.PLUMBING,
	serviceLocation: ServiceLocation.SEOUL,
	serviceTitle: 'Repair home plumbing',
	serviceImages: ['uploads/services/plumbing.png'],
};
const provider = { _id: memberId, memberNick: 'Provider', memberImage: '', memberDesc: 'Home services', memberServices: 1 };
const listing = { ...validInput, _id: serviceId, memberId, serviceStatus: ServiceStatus.ACTIVE, serviceLikes: 0, serviceViews: 0, serviceComments: 0, serviceRank: 0 };
const OfflineService = model('OfflineServiceMigration', ServiceSchema);

function query(value: unknown) {
	return { lean: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) };
}

function harness(status: ServiceStatus = ServiceStatus.ACTIVE) {
	const current = { ...listing, serviceStatus: status };
	const serviceModel = {
		create: jest.fn().mockResolvedValue(current),
		findOne: jest.fn().mockImplementation(() => query({ ...current })),
		findOneAndUpdate: jest.fn().mockImplementation(() => query({ ...current })),
		findByIdAndUpdate: jest.fn().mockImplementation(() => query({ ...current })),
		findOneAndDelete: jest.fn().mockImplementation(() => query({ ...current })),
		aggregate: jest.fn().mockImplementation(() => query([{ list: [], metaCounter: [] }])),
	};
	const memberQuery = query(provider);
	const memberModel = { findOne: jest.fn().mockReturnValue(memberQuery) };
	const members = { memberStatsEditor: jest.fn().mockResolvedValue(provider) };
	const views = { recordView: jest.fn().mockResolvedValue(null), getVisitedServices: jest.fn().mockResolvedValue({ list: [], metaCounter: [] }) };
	const likes = { toggleLike: jest.fn().mockResolvedValue(1), checkLikeExistence: jest.fn().mockResolvedValue([]), getFavoriteServices: jest.fn().mockResolvedValue({ list: [], metaCounter: [] }) };
	const notifications = { record: jest.fn().mockResolvedValue(undefined) };
	const service = new ServiceService(serviceModel as any, members as any, views as any, likes as any, memberModel as any, notifications as any);
	return { service, serviceModel, memberModel, memberQuery, members, views, likes, notifications };
}

function inputErrors(type: any, data: object) {
	return validateSync(plainToInstance(type, data));
}

describe('Service model and validation (offline)', () => {
	it('defines the agreed categories, statuses, roles and location set', () => {
		expect(Object.values(ServiceCategory)).toEqual(['PLUMBING', 'ELECTRICAL', 'CLEANING', 'HVAC', 'HANDYMAN', 'OTHER']);
		expect(Object.values(ServiceStatus)).toEqual(['ACTIVE', 'PAUSED', 'DELETE']);
		expect(Object.values(ServiceLocation)).toEqual(['SEOUL', 'BUSAN', 'INCHEON', 'DAEGU', 'GYEONGJU', 'GWANGJU', 'CHONJU', 'DAEJON', 'JEJU']);
		expect(Object.values(MemberType)).toEqual(['USER', 'AGENT', 'ADMIN']);
	});

	it.each(Object.values(ServiceCategory))('accepts category %s without a price', (serviceCategory) => {
		const doc = new OfflineService({ ...validInput, memberId, serviceCategory });
		expect(doc.validateSync()).toBeUndefined();
		expect(doc.servicePrice).toBeUndefined();
		expect(doc.serviceStatus).toBe(ServiceStatus.ACTIVE);
		expect([doc.serviceViews, doc.serviceLikes, doc.serviceComments, doc.serviceRank]).toEqual([0, 0, 0, 0]);
	});

	it('uses service references and non-unique discovery/owner indexes', () => {
		expect(ServiceSchema.options.collection).toBe('services');
		expect(ServiceSchema.options.timestamps).toBe(true);
		expect(ServiceSchema.indexes().map(([keys]) => keys)).toEqual([
			{ serviceStatus: 1, serviceLocation: 1, serviceCategory: 1 }, { memberId: 1, serviceStatus: 1 },
		]);
		expect(ServiceSchema.indexes().every(([, options]) => !options.unique)).toBe(true);
		expect((ServiceSchema.path('memberId') as any).options.ref).toBe('Member');
		expect((NotificationSchema.path('serviceId') as any).options.ref).toBe('Service');
		expect(NotificationSchema.path('propertyId')).toBeUndefined();
		expect(MemberSchema.path('memberServices')).toBeDefined();
		expect(MemberSchema.path('memberProperties')).toBeUndefined();
	});

	it('removes real-estate fields and rejects absent required service data', () => {
		for (const field of ['propertyTitle', 'propertyType', 'serviceAddress', 'serviceSquare', 'serviceRooms', 'serviceBeds', 'serviceRent', 'serviceBarter', 'constructedAt', 'soldAt']) {
			expect(ServiceSchema.path(field)).toBeUndefined();
		}
		for (const field of ['serviceCategory', 'serviceLocation', 'serviceTitle', 'serviceImages', 'memberId']) {
			const input: any = { ...validInput, memberId }; delete input[field];
			expect(new OfflineService(input).validateSync()).toBeDefined();
		}
	});

	it.each([-1, 1.5, 2147483648])('rejects invalid KRW price %s in schema and DTO', (servicePrice) => {
		expect(new OfflineService({ ...validInput, memberId, servicePrice }).validateSync()).toBeDefined();
		expect(inputErrors(ServiceInput, { ...validInput, servicePrice })).not.toHaveLength(0);
	});

	it.each([undefined, null, 0, 10000])('accepts optional integer price %s', (servicePrice) => {
		expect(inputErrors(ServiceInput, { ...validInput, servicePrice })).toHaveLength(0);
		expect(new OfflineService({ ...validInput, memberId, servicePrice }).validateSync()).toBeUndefined();
	});

	it.each([[], Array(11).fill('image.png'), ['']].map((images) => [images]))('rejects invalid image lists', (serviceImages) => {
		expect(inputErrors(ServiceInput, { ...validInput, serviceImages })).not.toHaveLength(0);
		expect(new OfflineService({ ...validInput, memberId, serviceImages }).validateSync()).toBeDefined();
	});

	it('validates nested search, ordered ranges, dates, IDs, sorts and pagination', () => {
		const valid = { page: 1, limit: 100, sort: 'servicePrice', search: { categoryList: ['PLUMBING'], locationList: ['SEOUL'], pricesRange: { start: 0, end: 10000 }, periodsRange: { start: '2026-01-01', end: '2026-12-31' } } };
		expect(inputErrors(ServicesInquiry, valid)).toHaveLength(0);
		for (const invalid of [
			{ ...valid, limit: 101 }, { ...valid, page: 0 }, { ...valid, limit: 1.5 }, { ...valid, sort: 'propertyPrice' },
			{ ...valid, search: { memberId: 'invalid' } }, { ...valid, search: { categoryList: ['APARTMENT'] } },
			{ ...valid, search: { locationList: ['UNKNOWN'] } }, { ...valid, search: { pricesRange: { start: 10, end: 1 } } },
			{ ...valid, search: { periodsRange: { start: '2026-12-31', end: '2026-01-01' } } },
			{ ...valid, search: { periodsRange: { start: 'invalid', end: '2026-01-01' } } }, { ...valid, search: undefined },
		]) expect(inputErrors(ServicesInquiry, invalid)).not.toHaveLength(0);
		expect(inputErrors(AgentServicesInquiry, { page: 1, limit: 10, search: { serviceStatus: 'SOLD' } })).not.toHaveLength(0);
		expect(inputErrors(AllServicesInquiry, { page: 1, limit: 10, search: { serviceStatus: 'DELETE' } })).toHaveLength(0);
		expect(inputErrors(OrdinaryInquiry, { page: 1, limit: 101 })).not.toHaveLength(0);
	});

	it('allows clearing the price but rejects null required update fields and malformed IDs', () => {
		expect(inputErrors(ServiceUpdate, { _id: serviceId.toHexString(), servicePrice: null })).toHaveLength(0);
		for (const patch of [{ _id: 'invalid' }, { _id: serviceId.toHexString(), serviceStatus: null }, { _id: serviceId.toHexString(), serviceImages: null }]) {
			expect(inputErrors(ServiceUpdate, patch)).not.toHaveLength(0);
		}
	});
});

describe('Service lifecycle and discovery (mocked persistence)', () => {
	it('creates only for an active provider, strips client counters/status and increments active count', async () => {
		const h = harness();
		await h.service.createService({ ...validInput, memberId, serviceStatus: ServiceStatus.DELETE, serviceLikes: 999 } as any);
		expect(h.memberModel.findOne).toHaveBeenCalledWith({ _id: memberId, memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE });
		expect(h.serviceModel.create).toHaveBeenCalledWith({ ...validInput, memberId });
		expect(h.members.memberStatsEditor).toHaveBeenCalledWith({ _id: memberId, targetKey: 'memberServices', modifier: 1 });
	});

	it('rejects a missing/ineligible owner before creating a service', async () => {
		const h = harness();
		await expect(h.service.createService(validInput)).rejects.toThrow();
		h.memberModel.findOne.mockReturnValue(query(null));
		await expect(h.service.createService({ ...validInput, memberId })).rejects.toThrow();
		expect(h.serviceModel.create).not.toHaveBeenCalled();
	});

	it.each([
		[ServiceStatus.ACTIVE, ServiceStatus.PAUSED, -1], [ServiceStatus.PAUSED, ServiceStatus.ACTIVE, 1],
		[ServiceStatus.ACTIVE, ServiceStatus.DELETE, -1], [ServiceStatus.PAUSED, ServiceStatus.DELETE, 0],
		[ServiceStatus.ACTIVE, ServiceStatus.ACTIVE, 0], [ServiceStatus.PAUSED, ServiceStatus.PAUSED, 0],
	])('applies %s -> %s with active count delta %s', async (previous, next, delta) => {
		const h = harness(previous);
		await h.service.updateService(memberId as any, { _id: serviceId as any, serviceStatus: next });
		const [search, update, options] = h.serviceModel.findOneAndUpdate.mock.calls[0];
		expect(search).toEqual({ _id: serviceId, memberId, serviceStatus: previous });
		expect(update.$set.serviceStatus).toBe(next);
		expect(options).toEqual({ new: true, runValidators: true });
		if (next === ServiceStatus.DELETE) expect(update.$set.deletedAt).toBeInstanceOf(Date);
		if (delta) expect(h.members.memberStatsEditor).toHaveBeenCalledWith({ _id: memberId, targetKey: 'memberServices', modifier: delta });
		else expect(h.members.memberStatsEditor).not.toHaveBeenCalled();
	});

	it('does not update counters when an ownership/status predicate loses a race', async () => {
		const h = harness();
		h.serviceModel.findOneAndUpdate.mockImplementation(() => query(null));
		await expect(h.service.updateService(memberId as any, { _id: serviceId as any, serviceStatus: ServiceStatus.PAUSED })).rejects.toThrow();
		expect(h.members.memberStatsEditor).not.toHaveBeenCalled();
	});

	it('cannot restore a deleted or unowned listing', async () => {
		const h = harness();
		h.serviceModel.findOne.mockImplementation(() => query(null));
		await expect(h.service.updateService(memberId as any, { _id: serviceId as any, serviceStatus: ServiceStatus.ACTIVE })).rejects.toThrow();
		expect(h.serviceModel.findOne).toHaveBeenCalledWith({ _id: serviceId, memberId, serviceStatus: { $ne: ServiceStatus.DELETE } });
		expect(h.serviceModel.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('clears a price with $unset and never updates server-owned fields', async () => {
		const h = harness();
		await h.service.updateService(memberId as any, { _id: serviceId, servicePrice: null, memberId: new Types.ObjectId(), serviceRank: 99, deletedAt: new Date() } as any);
		const update = h.serviceModel.findOneAndUpdate.mock.calls[0][1];
		expect(update).toEqual({ $set: {}, $unset: { servicePrice: 1 } });
		expect(h.members.memberStatsEditor).not.toHaveBeenCalled();
	});

	it('notifies an AGENT only for an ADMIN status transition, never for ordinary edits or same status', async () => {
		const h = harness();
		await h.service.updateService(memberId as any, { _id: serviceId as any, serviceStatus: ServiceStatus.PAUSED });
		expect(h.notifications.record).not.toHaveBeenCalled();
		await h.service.updateServiceByAdmin({ _id: serviceId as any, serviceStatus: ServiceStatus.ACTIVE }, memberId as any);
		expect(h.notifications.record).not.toHaveBeenCalled();
		await h.service.updateServiceByAdmin({ _id: serviceId as any, serviceStatus: ServiceStatus.PAUSED }, memberId as any);
		expect(h.notifications.record).toHaveBeenCalledWith(expect.objectContaining({
			notificationType: 'SERVICE_STATUS', receiverId: memberId, serviceStatus: ServiceStatus.PAUSED, serviceId,
		}));
	});

	it('admin update scopes by ID without owner restriction and still counts transitions', async () => {
		const h = harness(ServiceStatus.PAUSED);
		await h.service.updateServiceByAdmin({ _id: serviceId as any, serviceStatus: ServiceStatus.ACTIVE }, memberId as any);
		expect(h.serviceModel.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: serviceId, serviceStatus: ServiceStatus.PAUSED });
		expect(h.members.memberStatsEditor).toHaveBeenCalledWith({ _id: memberId, targetKey: 'memberServices', modifier: 1 });
	});

	it('permanently removes only DELETE listings', async () => {
		const h = harness();
		await h.service.removeServiceByAdmin(serviceId as any);
		expect(h.serviceModel.findOneAndDelete).toHaveBeenCalledWith({ _id: serviceId, serviceStatus: ServiceStatus.DELETE });
	});

	it('public detail rejects invisible listings/providers before recording interactions', async () => {
		const h = harness();
		h.serviceModel.findOne.mockImplementation(() => query(null));
		await expect(h.service.getService(memberId as any, serviceId as any)).rejects.toThrow();
		expect(h.serviceModel.findOne).toHaveBeenCalledWith({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE });
		expect(h.views.recordView).not.toHaveBeenCalled();
		h.serviceModel.findOne.mockImplementation(() => query({ ...listing }));
		h.memberModel.findOne.mockReturnValue(query(null));
		await expect(h.service.getService(memberId as any, serviceId as any)).rejects.toThrow();
		expect(h.views.recordView).not.toHaveBeenCalled();
	});

	it('public detail returns a projected provider and records at most one view', async () => {
		const h = harness();
		h.views.recordView.mockResolvedValue({} as any);
		const result = await h.service.getService(memberId as any, serviceId as any);
		expect(h.memberQuery.select).toHaveBeenCalledWith(serviceProviderProjection);
		expect(Object.keys(result.memberData!)).toEqual(['_id', 'memberNick', 'memberImage', 'memberDesc', 'memberServices']);
		expect(h.views.recordView).toHaveBeenCalledWith({ memberId, viewRefId: serviceId, viewGroup: ViewGroup.SERVICE });
		expect(h.serviceModel.findByIdAndUpdate).toHaveBeenCalledWith(serviceId, { $inc: { serviceViews: 1 } }, { new: true, runValidators: true });
		h.serviceModel.findByIdAndUpdate.mockClear();
		h.views.recordView.mockResolvedValue(null);
		await h.service.getService(memberId as any, serviceId as any);
		expect(h.serviceModel.findByIdAndUpdate).not.toHaveBeenCalled();
	});

	it('likes only visible services using SERVICE routing', async () => {
		const h = harness();
		await h.service.likeTargetService(memberId as any, serviceId as any);
		expect(h.likes.toggleLike).toHaveBeenCalledWith({ memberId, likeRefId: serviceId, likeGroup: LikeGroup.SERVICE });
		expect(h.serviceModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({ $inc: { serviceLikes: 1 } });
	});

	it('filters visible providers before pagination/counting and treats search text literally', async () => {
		const h = harness();
		await h.service.getServices(null, { page: 2, limit: 10, sort: 'servicePrice', search: { text: 'fix.*[pipe]', categoryList: [ServiceCategory.PLUMBING], locationList: [ServiceLocation.SEOUL], memberId: memberId as any } });
		const pipeline = h.serviceModel.aggregate.mock.calls[0][0];
		expect(pipeline[0].$match).toMatchObject({ serviceStatus: 'ACTIVE', servicePrice: { $type: 'number' }, serviceTitle: { $regex: 'fix\\.\\*\\[pipe\\]', $options: 'i' }, memberId });
		expect(pipeline[1].$lookup.pipeline[1]).toEqual({ $match: { memberType: 'AGENT', memberStatus: 'ACTIVE' } });
		expect(pipeline[1].$lookup.pipeline[2]).toEqual({ $project: serviceProviderProjection });
		expect(pipeline[4].$facet.list.slice(0, 2)).toEqual([{ $skip: 10 }, { $limit: 10 }]);
		expect(pipeline[4].$facet.metaCounter).toEqual([{ $count: 'total' }]);
	});

	it('uses numeric price ranges and listing creation dates', async () => {
		const h = harness(); const start = new Date('2026-01-01'); const end = new Date('2026-12-31');
		await h.service.getServices(null, { page: 1, limit: 10, search: { pricesRange: { start: 0, end: 10000 }, periodsRange: { start, end } } });
		expect(h.serviceModel.aggregate.mock.calls[0][0][0].$match).toEqual({ serviceStatus: 'ACTIVE', servicePrice: { $type: 'number', $gte: 0, $lte: 10000 }, createdAt: { $gte: start, $lte: end } });
	});

	it('owner management restricts to own ACTIVE/PAUSED listings; admin may see DELETE', async () => {
		const h = harness();
		await h.service.getAgentServices(memberId as any, { page: 1, limit: 10, search: {} });
		expect(h.serviceModel.aggregate.mock.calls[0][0][0].$match).toEqual({ memberId, serviceStatus: { $in: ['ACTIVE', 'PAUSED'] } });
		await expect(h.service.getAgentServices(memberId as any, { page: 1, limit: 10, search: { serviceStatus: ServiceStatus.DELETE } })).rejects.toThrow();
		await h.service.getAllServicesByAdmin({ page: 1, limit: 10, search: { serviceStatus: ServiceStatus.DELETE } });
		const pipeline = h.serviceModel.aggregate.mock.calls[1][0];
		expect(pipeline[0].$match).toEqual({ serviceStatus: 'DELETE' });
		expect(pipeline[1].$lookup.pipeline).toHaveLength(2);
	});
});

describe('Social integration regressions (offline)', () => {
	it.each(['like', 'view'])('%s history hides inactive services/providers before counting and projects profiles', async (domain) => {
		const aggregate = jest.fn().mockReturnValue(query([{ list: [], metaCounter: [] }]));
		if (domain === 'like') await new LikeService({ aggregate } as any).getFavoriteServices(memberId as any, { page: 1, limit: 10 });
		else await new ViewService({ aggregate } as any).getVisitedServices(memberId as any, { page: 1, limit: 10 });
		const pipeline = aggregate.mock.calls[0][0];
		const alias = domain === 'like' ? 'favoriteService' : 'visitedService';
		expect(pipeline[0].$match).toEqual({ [domain === 'like' ? 'likeGroup' : 'viewGroup']: 'SERVICE', memberId });
		expect(pipeline[2].$lookup.from).toBe('services');
		expect(pipeline[4]).toEqual({ $match: { [`${alias}.serviceStatus`]: 'ACTIVE' } });
		expect(pipeline[5].$lookup.pipeline).toContainEqual({ $match: { memberType: 'AGENT', memberStatus: 'ACTIVE' } });
		expect(pipeline[5].$lookup.pipeline).toContainEqual({ $project: serviceProviderProjection });
		expect(pipeline[7].$facet.metaCounter).toEqual([{ $count: 'total' }]);
	});

	it.each([CommentGroup.SERVICE, CommentGroup.MEMBER, CommentGroup.ARTICLE])('routes %s comment counters to the correct domain', async (commentGroup) => {
		const comments = { create: jest.fn().mockResolvedValue({}) };
		const members = { memberStatsEditor: jest.fn() };
		const services = { assertServiceVisible: jest.fn().mockResolvedValue(listing), serviceStatsEditor: jest.fn() };
		const articles = { boardArticleStatsEditor: jest.fn() };
		await new CommentService(comments as any, members as any, services as any, articles as any).createComment(memberId as any, { commentGroup, commentRefId: serviceId as any, commentContent: 'Question' });
		const calls = [services.serviceStatsEditor, members.memberStatsEditor, articles.boardArticleStatsEditor];
		const index = [CommentGroup.SERVICE, CommentGroup.MEMBER, CommentGroup.ARTICLE].indexOf(commentGroup);
		calls.forEach((fn, i) => expect(fn).toHaveBeenCalledTimes(i === index ? 1 : 0));
		if (commentGroup === CommentGroup.SERVICE) {
			expect(services.assertServiceVisible).toHaveBeenCalledWith(serviceId);
			expect(services.assertServiceVisible.mock.invocationCallOrder[0]).toBeLessThan(comments.create.mock.invocationCallOrder[0]);
			expect(services.serviceStatsEditor).toHaveBeenCalledWith({ _id: serviceId, targetKey: 'serviceComments', modifier: 1 });
		} else expect(services.assertServiceVisible).not.toHaveBeenCalled();
	});

	it('rejects an invisible SERVICE comment before persistence', async () => {
		const create = jest.fn();
		const services = { assertServiceVisible: jest.fn().mockRejectedValue(new Error('not visible')) };
		await expect(new CommentService({ create } as any, {} as any, services as any, {} as any).createComment(memberId as any, { commentGroup: CommentGroup.SERVICE, commentRefId: serviceId as any, commentContent: 'Question' })).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();
	});

	it('preserves member/article interaction enum values and provider helper projection', () => {
		for (const group of [LikeGroup, ViewGroup, CommentGroup, NotificationGroup]) {
			expect(Object.values(group).sort()).toEqual(['ARTICLE', 'MEMBER', 'SERVICE']);
		}
		expect(lookupServiceProvider().$lookup.pipeline).toContainEqual({ $project: serviceProviderProjection });
		expect(Object.keys(serviceProviderProjection).sort()).toEqual(['_id', 'memberDesc', 'memberImage', 'memberNick', 'memberServices']);
	});
});

describe('GraphQL contract and authorization metadata (no application/database bootstrap)', () => {
	it('generates the complete Service contract, safe provider and renamed Member counter', async () => {
		const module = await Test.createTestingModule({ imports: [GraphQLSchemaBuilderModule] }).compile();
		try {
			const schema = await module.get(GraphQLSchemaFactory).create([ServiceResolver], { orphanedTypes: [Member] });
			const queries = Object.keys(schema.getQueryType()!.getFields());
			const mutations = Object.keys(schema.getMutationType()!.getFields());
			expect(queries.sort()).toEqual(['getAgentServices', 'getAllServicesByAdmin', 'getFavorites', 'getService', 'getServices', 'getVisited'].sort());
			expect(mutations.sort()).toEqual(['createService', 'updateService', 'likeTargetService', 'updateServiceByAdmin', 'removeServiceByAdmin'].sort());
			expect(schema.getType('Property')).toBeUndefined();
			const fields = (schema.getType('Service') as GraphQLObjectType).getFields();
			expect(String(fields.servicePrice.type)).toBe('Int');
			expect(String(fields.serviceCategory.type)).toBe('ServiceCategory!');
			expect(String(fields.serviceLocation.type)).toBe('ServiceLocation!');
			expect(Object.keys((schema.getType('ServiceProvider') as GraphQLObjectType).getFields()).sort()).toEqual(Object.keys(serviceProviderProjection).sort());
			expect((schema.getType('Member') as GraphQLObjectType).getFields().memberServices).toBeDefined();
			expect((schema.getType('Member') as GraphQLObjectType).getFields().memberProperties).toBeUndefined();
			const input = (schema.getType('ServiceInput') as GraphQLInputObjectType).getFields();
			expect(input.memberId).toBeUndefined(); expect(input.serviceStatus).toBeUndefined(); expect(input.serviceRank).toBeUndefined();
			const search = (schema.getType('ServiceSearch') as GraphQLInputObjectType).getFields();
			expect(search.categoryList).toBeDefined(); expect(search.roomsList).toBeUndefined(); expect(search.options).toBeUndefined();
			expect(validate(schema, parse('query { getService(serviceId: "abc") { _id servicePrice memberData { memberNick memberServices } } }'))).toHaveLength(0);
			expect(validate(schema, parse('query { getService(serviceId: "abc") { memberData { memberPhone memberAddress accessToken } } }'))).not.toHaveLength(0);
		} finally { await module.close(); }
	});

	it('preserves role restrictions and public/auth guard metadata', () => {
		for (const name of ['createService', 'updateService', 'getAgentServices']) {
			expect(Reflect.getMetadata('roles', ServiceResolver.prototype[name])).toEqual([MemberType.AGENT]);
			expect(Reflect.getMetadata(GUARDS_METADATA, ServiceResolver.prototype[name])).toEqual([RolesGuard]);
		}
		for (const name of ['getAllServicesByAdmin', 'updateServiceByAdmin', 'removeServiceByAdmin']) expect(Reflect.getMetadata('roles', ServiceResolver.prototype[name])).toEqual([MemberType.ADMIN]);
		for (const name of ['getServices', 'getService']) expect(Reflect.getMetadata(GUARDS_METADATA, ServiceResolver.prototype[name])).toEqual([WithoutGuard]);
		for (const name of ['getFavorites', 'getVisited', 'likeTargetService']) expect(Reflect.getMetadata(GUARDS_METADATA, ServiceResolver.prototype[name])).toEqual([AuthGuard]);
	});

	it('assigns authenticated ownership and rejects malformed service IDs', async () => {
		const service = { createService: jest.fn().mockResolvedValue(listing), getService: jest.fn() };
		const resolver = new ServiceResolver(service as any);
		await resolver.createService({ ...validInput, memberId: new Types.ObjectId() } as any, memberId as any);
		expect(service.createService.mock.calls[0][0].memberId).toBe(memberId);
		await expect(resolver.getService('invalid', memberId as any)).rejects.toThrow('Invalid service ID');
		expect(service.getService).not.toHaveBeenCalled();
	});
});
