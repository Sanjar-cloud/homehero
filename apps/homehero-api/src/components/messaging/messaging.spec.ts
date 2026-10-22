import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: jest.fn(() => 'offline-image') }));

import { Test } from '@nestjs/testing';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { model, Types } from 'mongoose';
import { GraphQLInputObjectType, GraphQLObjectType, parse, validate } from 'graphql';
import { of, throwError } from 'rxjs';
import ConversationSchema from '../../schemas/Conversation.model';
import MessageSchema from '../../schemas/Message.model';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { StartConversationInput, SendMessageInput, ConversationsInquiry, MessagesInquiry } from '../../libs/dto/messaging/messaging.input';
import { MessagingService } from './messaging.service';
import { MessagingResolver } from './messaging.resolver';
import { MessagingGuard } from './messaging.guard';
import { LoggingInterceptor } from '../../libs/interceptor/Logging.interceptor';

const userId = new Types.ObjectId();
const agentId = new Types.ObjectId();
const outsiderId = new Types.ObjectId();
const conversationId = new Types.ObjectId();
const serviceId = new Types.ObjectId();
const secondServiceId = new Types.ObjectId();
const conversation = { _id: conversationId, userId, agentId, createdAt: new Date(), updatedAt: new Date() };
const pagination = { page: 1, limit: 10 };
const OfflineConversation = model('OfflineMessagingConversation', ConversationSchema);
const OfflineMessage = model('OfflineMessagingMessage', MessageSchema);

function query(value: unknown) {
	return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) };
}
function harness() {
	const accounts = new Map([userId, agentId, outsiderId].map((id) => [String(id), {
		_id: id, memberType: id === agentId ? MemberType.AGENT : MemberType.USER, memberStatus: MemberStatus.ACTIVE,
	}]));
	const members = { findOne: jest.fn((match) => query(accounts.get(String(match._id)) ?? null)) };
	const conversations = {
		findOne: jest.fn((match) => query(
			(!match._id || String(match._id) === String(conversationId)) &&
			(!match.userId || String(match.userId) === String(userId)) &&
			(!match.agentId || String(match.agentId) === String(agentId)) ? conversation : null,
		)),
		findOneAndUpdate: jest.fn(() => query(conversation)),
		aggregate: jest.fn(() => query([{ ...conversation, activityAt: conversation.createdAt, lastMessage: null, list: [], metaCounter: [] }])),
	};
	const messages = {
		create: jest.fn(async (input) => ({ ...input, _id: new Types.ObjectId(), createdAt: new Date() })),
		aggregate: jest.fn(() => query([{ list: [], metaCounter: [] }])),
	};
	const services = { assertServiceVisible: jest.fn(async (id) => ({ _id: id, memberId: agentId, serviceTitle: 'Plumbing' })) };
	const notifications = { record: jest.fn().mockResolvedValue(undefined), messageEvent: jest.fn((message, receiverId) => ({ message, receiverId })) };
	const service = new MessagingService(conversations as any, messages as any, members as any, services as any, notifications as any);
	return { service, conversations, messages, members, accounts, services, notifications };
}
const send = { conversationId: String(conversationId), text: 'Hello' };

describe('Messaging models and validation', () => {
	it('declares a unique pair and deterministic history index without a service pair key', () => {
		expect(ConversationSchema.indexes()).toContainEqual([{ userId: 1, agentId: 1 }, expect.objectContaining({ unique: true })]);
		expect(MessageSchema.indexes()).toContainEqual([{ conversationId: 1, createdAt: -1, _id: -1 }, expect.any(Object)]);
		expect(ConversationSchema.path('serviceId')).toBeUndefined();
		expect(ConversationSchema.get('collection')).toBe('conversations');
		expect(MessageSchema.get('collection')).toBe('messages');
	});
	it('requires participants and valid message fields without connecting to MongoDB', () => {
		expect(new OfflineConversation().validateSync()).toBeDefined();
		expect(new OfflineMessage({ conversationId, senderId: userId, text: '  ' }).validateSync()).toBeDefined();
		const message = new OfflineMessage({ conversationId, senderId: userId, text: ' Hello ' });
		expect(message.validateSync()).toBeUndefined();
		expect(message.text).toBe('Hello');
		expect(message.serviceContext).toBeNull();
		expect(MessageSchema.path('updatedAt')).toBeUndefined();
		expect(MessageSchema.path('text').options.immutable).toBe(true);
	});
	it.each(['', ' ', 'x'.repeat(2001)])('rejects invalid text length', (text) => {
		expect(validateSync(plainToInstance(SendMessageInput, { ...send, text })).length).toBeGreaterThan(0);
	});
	it.each([{ page: 0, limit: 10 }, { page: 1, limit: 101 }, { page: 1.5, limit: 1 }])('validates pagination %j', (input) => {
		expect(validateSync(plainToInstance(ConversationsInquiry, input)).length).toBeGreaterThan(0);
	});
	it('validates IDs and trims text', () => {
		expect(validateSync(plainToInstance(StartConversationInput, { serviceId: 'bad' })).length).toBeGreaterThan(0);
		expect(validateSync(plainToInstance(MessagesInquiry, { ...pagination, conversationId: 'bad' })).length).toBeGreaterThan(0);
		expect(plainToInstance(SendMessageInput, { ...send, text: ' Hello ' }).text).toBe('Hello');
	});
});

describe('Messaging persistence and permissions', () => {
	it('persists the recipient notification before publishing the realtime message', async () => {
		const h = harness();
		const order: string[] = [];
		h.notifications.record.mockImplementation(async () => { order.push('notification'); });
		h.service.messageEvents.subscribe(() => order.push('message'));
		const result = await h.service.sendMessage(userId, send);
		expect(h.notifications.messageEvent).toHaveBeenCalledWith(result, agentId);
		expect(order).toEqual(['notification', 'message']);
	});

	it('uses the same pair for different services, creates no messages or stored context', async () => {
		const h = harness();
		const first = await h.service.startConversation(userId, { serviceId: String(serviceId) });
		const second = await h.service.startConversation(userId, { serviceId: String(secondServiceId) });
		expect(first._id).toEqual(second._id);
		for (const call of h.conversations.findOneAndUpdate.mock.calls as any[]) {
			expect(call).toEqual([{ userId, agentId }, { $setOnInsert: { userId, agentId } }, { upsert: true, new: true, runValidators: true }]);
		}
		expect(h.messages.create).not.toHaveBeenCalled();
	});
	it('recovers a concurrent duplicate key by fetching the exact pair', async () => {
		const h = harness();
		h.conversations.findOneAndUpdate.mockImplementationOnce(() => ({ ...query(null), exec: jest.fn().mockRejectedValue({ code: 11000 }) }));
		const results = await Promise.all([serviceId, secondServiceId].map((id) => h.service.startConversation(userId, { serviceId: String(id) })));
		expect(results[0]._id).toEqual(results[1]._id);
		expect(h.conversations.findOne).toHaveBeenCalledWith({ userId, agentId });
	});
	it.each([MemberType.AGENT, MemberType.ADMIN])('cannot initiate as %s', async (role) => {
		const h = harness(); h.accounts.get(String(userId)).memberType = role;
		await expect(h.service.startConversation(userId, { serviceId: String(serviceId) })).rejects.toThrow('Conversation unavailable');
		expect(h.conversations.findOneAndUpdate).not.toHaveBeenCalled();
	});
	it('restricts lists by current participant role and keeps profile projections private', async () => {
		const h = harness();
		await h.service.getConversations(agentId, pagination);
		const pipeline: any = h.conversations.aggregate.mock.calls[0][0];
		expect(pipeline[0]).toEqual({ $match: { agentId } });
		const list = pipeline[1].$facet.list;
		expect(list).toContainEqual({ $sort: { activityAt: -1, _id: -1 } });
		const profiles = list.filter((stage) => stage.$lookup?.from === 'members');
		expect(profiles).toHaveLength(2);
		for (const profile of profiles) expect(profile.$lookup.pipeline[1].$project).toEqual({ _id: 1, memberNick: 1, memberImage: 1 });
	});
	it.each(['history', 'send', 'delivery'])('denies outsider %s with no private lookup', async (action) => {
		const h = harness();
		const operation = action === 'history' ? h.service.getMessages(outsiderId, { ...pagination, conversationId: String(conversationId) }) : action === 'send' ? h.service.sendMessage(outsiderId, send) : h.service.authorizeDelivery(outsiderId, conversationId);
		await expect(operation).rejects.toThrow('Conversation unavailable');
		expect(h.messages.aggregate).not.toHaveBeenCalled();
		expect(h.messages.create).not.toHaveBeenCalled();
	});
	it.each([MemberType.ADMIN, MemberType.AGENT])('denies saved USER position when current role is %s', async (role) => {
		const h = harness(); h.accounts.get(String(userId)).memberType = role;
		await expect(h.service.getMessages(userId, { ...pagination, conversationId: String(conversationId) })).rejects.toThrow('Conversation unavailable');
	});
	it.each([MemberStatus.BLOCK, MemberStatus.DELETE])('keeps active history but prevents send when other account is %s', async (status) => {
		const h = harness(); h.accounts.get(String(agentId)).memberStatus = status;
		await expect(h.service.getMessages(userId, { ...pagination, conversationId: String(conversationId) })).resolves.toEqual({ list: [], metaCounter: [] });
		await expect(h.service.sendMessage(userId, send)).rejects.toThrow('Conversation unavailable');
		await expect(h.service.getMessages(agentId, { ...pagination, conversationId: String(conversationId) })).rejects.toThrow('Conversation unavailable');
	});
	it('persists server identity and emits only after creation resolves', async () => {
		const h = harness(); const events: any[] = [];
		h.service.messageEvents.subscribe((event) => events.push(event));
		let resolve: (value: any) => void;
		h.messages.create.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
		const pending = h.service.sendMessage(userId, { ...send, text: ' Hello ', senderId: outsiderId } as any);
		for (let i = 0; i < 12; i++) await Promise.resolve();
		expect(resolve).toBeDefined();
		expect(events).toHaveLength(0);
		resolve({ ...send, conversationId, senderId: userId, text: 'Hello', _id: new Types.ObjectId(), createdAt: new Date(), privateField: 'secret' });
		const saved = await pending;
		expect(saved.senderId).toEqual(userId);
		expect(saved).not.toHaveProperty('privateField');
		expect(events).toEqual([{ message: saved, userId, agentId }]);
		expect(h.messages.create).toHaveBeenCalledWith({ conversationId, senderId: userId, text: 'Hello', serviceContext: null });
	});
	it('emits nothing when persistence fails', async () => {
		const h = harness(); const listener = jest.fn(); h.service.messageEvents.subscribe(listener);
		h.messages.create.mockRejectedValueOnce(new Error('offline failure'));
		await expect(h.service.sendMessage(userId, send)).rejects.toThrow();
		expect(listener).not.toHaveBeenCalled();
	});
	it('allows AGENT ordinary messages without requiring an active service', async () => {
		const h = harness(); h.services.assertServiceVisible.mockRejectedValue(new Error('inactive'));
		await expect(h.service.sendMessage(agentId, send)).resolves.toMatchObject({ senderId: agentId });
		expect(h.services.assertServiceVisible).not.toHaveBeenCalled();
	});
	it('snapshots selected service title and preserves history without a service lookup', async () => {
		const h = harness();
		const saved = await h.service.sendMessage(userId, { ...send, serviceId: String(serviceId) });
		expect(saved.serviceContext).toEqual({ serviceId, serviceTitle: 'Plumbing' });
		h.services.assertServiceVisible.mockRejectedValue(new Error('deleted'));
		await h.service.getMessages(userId, { ...pagination, conversationId: String(conversationId) });
		expect(h.services.assertServiceVisible).toHaveBeenCalledTimes(1);
	});
	it('rejects AGENT context, unrelated provider and inactive service', async () => {
		const h = harness();
		await expect(h.service.sendMessage(agentId, { ...send, serviceId: String(serviceId) })).rejects.toThrow();
		h.services.assertServiceVisible.mockResolvedValueOnce({ _id: serviceId, memberId: outsiderId, serviceTitle: 'Other' });
		await expect(h.service.sendMessage(userId, { ...send, serviceId: String(serviceId) })).rejects.toThrow();
		h.services.assertServiceVisible.mockRejectedValueOnce(new Error('inactive'));
		await expect(h.service.sendMessage(userId, { ...send, serviceId: String(serviceId) })).rejects.toThrow();
		expect(h.messages.create).not.toHaveBeenCalled();
	});
	it('uses newest-first stable history pagination without consulting the other account', async () => {
		const h = harness(); await h.service.getMessages(userId, { page: 2, limit: 5, conversationId: String(conversationId) });
		const pipeline: any = h.messages.aggregate.mock.calls[0][0];
		expect(pipeline[0]).toEqual({ $match: { conversationId } });
		expect(pipeline[1].$facet.list.slice(0, 3)).toEqual([{ $sort: { createdAt: -1, _id: -1 } }, { $skip: 5 }, { $limit: 5 }]);
		expect(h.members.findOne).toHaveBeenCalledTimes(1);
	});
});

describe('GraphQL contracts and safe logging', () => {
	it('generates messaging schema without AppModule or a database connection', async () => {
		const module = await Test.createTestingModule({ imports: [GraphQLSchemaBuilderModule] }).compile();
		try {
			const schema = await module.get(GraphQLSchemaFactory).create([MessagingResolver]);
			const participant = schema.getType('ConversationParticipant') as GraphQLObjectType;
			expect(Object.keys(participant.getFields())).toEqual(['_id', 'memberNick', 'memberImage']);
			const input = schema.getType('SendMessageInput') as GraphQLInputObjectType;
			expect(Object.keys(input.getFields())).toEqual(['conversationId', 'text', 'serviceId']);
			const doc = parse(`mutation { startConversation(input: {serviceId: "${serviceId}"}) { _id userData { memberNick } } sendMessage(input: {conversationId: "${conversationId}", text: "Hello"}) { _id serviceContext { serviceTitle } } }`);
			expect(validate(schema, doc)).toEqual([]);
			expect(schema.getQueryType().getFields()).toHaveProperty('getMessages');
			expect(schema.getQueryType().getFields()).toHaveProperty('getConversations');
			expect(Reflect.getMetadata(GUARDS_METADATA, MessagingResolver)).toEqual([MessagingGuard]);
		} finally { await module.close(); }
	});
	it('requires a verified Bearer token, never a client body identity', async () => {
		const auth = { verifyToken: jest.fn(async () => ({ _id: userId })) };
		const guard = new MessagingGuard(auth as any);
		const req: any = { headers: { authorization: 'Bearer test-token' }, body: { authMember: { _id: outsiderId } } };
		const context: any = { getArgs: () => [null, {}, { req }, {}], getType: () => 'graphql', getClass: () => MessagingResolver, getHandler: () => MessagingResolver.prototype.sendMessage };
		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(req.messagingMemberId).toEqual(userId);
		req.headers.authorization = undefined;
		await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
		req.headers.authorization = 'Bearer invalid'; auth.verifyToken.mockRejectedValueOnce(new Error('private token') as never);
		await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
	});
	it('masks unexpected driver errors before global GraphQL error logging', async () => {
		const resolver = new MessagingResolver({ sendMessage: jest.fn().mockRejectedValue(new Error('PRIVATE_TEXT')) } as any);
		await expect(resolver.sendMessage(send, { req: { messagingMemberId: userId } })).rejects.toThrow('Messaging operation failed');
	});
	it('logs only metadata even for mixed GraphQL requests and errors', () => {
		const interceptor = new LoggingInterceptor();
		const logger = { log: jest.fn(), warn: jest.fn() }; (interceptor as any).logger = logger;
		const req = { body: { query: 'PRIVATE_QUERY', variables: { text: 'PRIVATE_TEXT' } }, headers: { authorization: 'PRIVATE_TOKEN' } };
		const context: any = { getType: () => 'graphql', getArgs: () => [null, {}, { req }, { fieldName: 'getServices', operation: { operation: 'query' } }], getClass: () => MessagingResolver, getHandler: () => MessagingResolver.prototype.getConversations };
		interceptor.intercept(context, { handle: () => of({ privateMessage: 'PRIVATE_RESPONSE' }) }).subscribe();
		interceptor.intercept(context, { handle: () => throwError(() => new Error('PRIVATE_ERROR')) }).subscribe({ error: () => undefined });
		expect(logger.log).toHaveBeenCalledTimes(1); expect(logger.warn).toHaveBeenCalledTimes(1);
		const logs = JSON.stringify([logger.log.mock.calls, logger.warn.mock.calls]);
		expect(logs).toContain('query getServices'); expect(logs).not.toContain('PRIVATE_');
	});
});
