import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: jest.fn(() => 'offline-image') }));
import {
	BadRequestException,
	ForbiddenException,
	InternalServerErrorException,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext, GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { model, Types } from 'mongoose';
import { printSchema } from 'graphql';
import NotificationSchema from '../../schemas/Notification.model';
import { NotificationStatus, NotificationType } from '../../libs/enums/notification.enum';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NotificationGuard } from './notification.guard';

const userId = new Types.ObjectId();
const agentId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const conversationId = new Types.ObjectId();
const messageId = new Types.ObjectId();
const page = { page: 1, limit: 10 };
function query(value: unknown) {
	return {
		select: jest.fn().mockReturnThis(),
		lean: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		exec: jest.fn().mockResolvedValue(value),
	};
}
function harness() {
	const accounts = new Map(
		[userId, agentId, otherId, adminId].map((id) => [
			String(id),
			{
				_id: id,
				memberNick: 'Account',
				memberType: id === agentId ? MemberType.AGENT : id === adminId ? MemberType.ADMIN : MemberType.USER,
				memberStatus: MemberStatus.ACTIVE,
			},
		]),
	);
	const records = new Map<string, any>();
	function matches(row: any, match: any) {
		return Object.entries(match).every(([key, value]: [string, any]) => {
			if (value?.$in) return value.$in.some((id: any) => String(id) === String(row[key]));
			if (value?.$lte) return row[key] <= value.$lte;
			if (value && '$ne' in Object(value)) return row[key] !== value.$ne;
			return String(value) === String(row[key]);
		});
	}
	function update(match: any, change: any, options: any = {}) {
		return {
			exec: jest.fn(async () => {
				const found = [...records.values()].find((row) => matches(row, match));
				if (found) {
					const changed = Object.entries(change.$set ?? {}).some(([key, val]) => found[key] !== val);
					Object.assign(found, change.$set);
					return { modifiedCount: Number(changed), upsertedCount: 0 };
				}
				if (!options.upsert) return { modifiedCount: 0, upsertedCount: 0 };
				const row = { _id: new Types.ObjectId(), createdAt: new Date(), ...change.$setOnInsert, ...change.$set };
				if (records.has(row.eventKey)) throw { code: 11000 };
				records.set(row.eventKey, row);
				return { modifiedCount: 0, upsertedCount: 1 };
			}),
		};
	}
	const notifications = {
		init: jest.fn().mockResolvedValue(undefined),
		updateOne: jest.fn(update),
		updateMany: jest.fn((match, change) => ({
			exec: jest.fn(async () => {
				let modifiedCount = 0;
				for (const row of records.values())
					if (matches(row, match)) {
						Object.assign(row, change.$set);
						modifiedCount++;
					}
				return { modifiedCount };
			}),
		})),
		find: jest.fn((match) => query([...records.values()].filter((row) => matches(row, match)))),
		countDocuments: jest.fn((match) => query([...records.values()].filter((row) => matches(row, match)).length)),
	};
	const members = { findOne: jest.fn((match) => query(accounts.get(String(match._id)) ?? null)) };
	const conversations = {
		findOne: jest.fn((match) =>
			query(
				String(match._id) === String(conversationId) &&
					(String(match.userId) === String(userId) || String(match.agentId) === String(agentId))
					? { _id: conversationId, userId, agentId }
					: null,
			),
		),
	};
	const saved = [{ _id: messageId, conversationId, senderId: userId }];
	const messages = { find: jest.fn((match) => query(saved.filter((row) => matches(row, match)))) };
	const service = new NotificationService(notifications as any, members as any, conversations as any, messages as any);
	const event = service.messageEvent(saved[0], agentId);
	return { service, event, accounts, records, notifications, members, conversations, messages };
}

describe('Notifications, offline persistence and permissions', () => {
	it('keeps legacy rows valid and deduplicates only indexed new event keys', () => {
		expect(NotificationSchema.indexes()).toContainEqual([
			{ eventKey: 1 },
			expect.objectContaining({
				unique: true,
				partialFilterExpression: { eventKey: { $type: 'string' } },
			}),
		]);
		const Offline = model('OfflineNotification', NotificationSchema);
		expect(
			new Offline({
				notificationType: NotificationType.LIKE,
				notificationGroup: 'MEMBER',
				notificationTitle: 'Legacy',
				authorId: userId,
				receiverId: agentId,
			}).validateSync(),
		).toBeUndefined();
	});

	it('persists only one unread notification for concurrent repetitions and emits only to its receiver', async () => {
		const h = harness();
		const changed: string[] = [];
		h.service.changes.subscribe((id) => changed.push(id));
		await Promise.all([h.service.record(h.event), h.service.record(h.event)]);
		expect(h.records.size).toBe(1);
		expect(changed).toEqual([String(agentId)]);
		expect([...h.records.values()][0]).toMatchObject({
			notificationStatus: NotificationStatus.WAIT,
			authorNick: 'Account',
			conversationId,
			messageId,
		});
		expect([...h.records.values()][0]).not.toHaveProperty('text');
		expect([...h.records.values()][0]).not.toHaveProperty('notificationDesc');
	});

	it('scopes listing, counts and single read to the authenticated receiver', async () => {
		const h = harness();
		await h.service.record(h.event);
		const row = [...h.records.values()][0];
		expect(await h.service.getNotifications(userId, page)).toMatchObject({ list: [], total: 0, unreadCount: 0 });
		expect(await h.service.getNotifications(agentId, page)).toMatchObject({ total: 1, unreadCount: 1 });
		await h.service.markNotificationRead(userId, String(row._id));
		expect(row.notificationStatus).toBe(NotificationStatus.WAIT);
		await h.service.markNotificationRead(agentId, String(row._id));
		expect((await h.service.getNotifications(agentId, page)).unreadCount).toBe(0);
		await h.service.markNotificationRead(agentId, String(row._id));
		expect(row.notificationStatus).toBe(NotificationStatus.READ);
	});

	it('mark all respects its time boundary, recipient and supported types', async () => {
		const h = harness();
		await h.service.record(h.event);
		const cutoff = new Date();
		const row = [...h.records.values()][0];
		row.createdAt = new Date(cutoff.getTime() - 1000);
		h.records.set('future', {
			...row,
			_id: new Types.ObjectId(),
			eventKey: 'future',
			createdAt: new Date(cutoff.getTime() + 1000),
		});
		h.records.set('other', { ...row, _id: new Types.ObjectId(), eventKey: 'other', receiverId: otherId });
		h.records.set('legacy', {
			...row,
			_id: new Types.ObjectId(),
			eventKey: 'legacy',
			notificationType: NotificationType.LIKE,
		});
		await h.service.markAllNotificationsRead(agentId, cutoff);
		expect(row.notificationStatus).toBe(NotificationStatus.READ);
		for (const key of ['future', 'other', 'legacy'])
			expect(h.records.get(key).notificationStatus).toBe(NotificationStatus.WAIT);
		await expect(h.service.markAllNotificationsRead(agentId, new Date(Date.now() + 100000))).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it('old message read receipts do not create historical inbox notifications', async () => {
		const h = harness();
		await h.service.markMessageNotificationsRead(agentId, {
			conversationId: String(conversationId),
			messageIds: [String(messageId)],
		});
		expect(await h.service.getNotifications(agentId, page)).toMatchObject({ list: [], unreadCount: 0, total: 0 });
	});

	it('a displayed message remains READ when the notification producer runs late', async () => {
		const h = harness();
		await h.service.markMessageNotificationsRead(agentId, {
			conversationId: String(conversationId),
			messageIds: [String(messageId)],
		});
		await h.service.record(h.event);
		expect(h.records.size).toBe(1);
		expect([...h.records.values()][0].notificationStatus).toBe(NotificationStatus.READ);
	});

	it('accepts only real received messages in an owned conversation', async () => {
		const h = harness();
		const input = {
			conversationId: String(conversationId),
			messageIds: [String(messageId), String(new Types.ObjectId())],
		};
		await expect(h.service.markMessageNotificationsRead(otherId, input)).rejects.toBeInstanceOf(ForbiddenException);
		await h.service.markMessageNotificationsRead(userId, input); // Own sent messages are not received notifications.
		expect(h.records.size).toBe(0);
		await h.service.markMessageNotificationsRead(agentId, input);
		expect(h.records.size).toBe(1);
	});

	it('handles a concurrent duplicate insert while applying the READ receipt', async () => {
		const h = harness();
		await h.service.record(h.event);
		h.notifications.updateOne.mockImplementationOnce(() => ({ exec: jest.fn().mockRejectedValue({ code: 11000 }) }));
		await h.service.markMessageNotificationsRead(agentId, {
			conversationId: String(conversationId),
			messageIds: [String(messageId)],
		});
		expect([...h.records.values()][0].notificationStatus).toBe(NotificationStatus.READ);
	});

	it('reveals an already-read receipt when the producer loses a duplicate-key race', async () => {
		const h = harness();
		await h.service.markMessageNotificationsRead(agentId, {
			conversationId: String(conversationId),
			messageIds: [String(messageId)],
		});
		h.notifications.updateOne.mockImplementationOnce(() => ({ exec: jest.fn().mockRejectedValue({ code: 11000 }) }));
		await h.service.record(h.event);
		expect(await h.service.getNotifications(agentId, page)).toMatchObject({ unreadCount: 0, total: 1 });
		expect([...h.records.values()][0].notificationStatus).toBe(NotificationStatus.READ);
	});

	it('rejects ADMIN, deleted, blocked and missing accounts with old JWT identities', async () => {
		const h = harness();
		await expect(h.service.getNotifications(adminId, page)).rejects.toBeInstanceOf(ForbiddenException);
		for (const status of [MemberStatus.BLOCK, MemberStatus.DELETE]) {
			h.accounts.get(String(agentId))!.memberStatus = status;
			await expect(h.service.getNotifications(agentId, page)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(h.service.markNotificationRead(agentId, String(messageId))).rejects.toBeInstanceOf(
				ForbiddenException,
			);
			await expect(h.service.markAllNotificationsRead(agentId, new Date())).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				h.service.markMessageNotificationsRead(agentId, {
					conversationId: String(conversationId),
					messageIds: [String(messageId)],
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		}
		h.accounts.delete(String(agentId));
		await expect(h.service.getNotifications(agentId, page)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('rejects malformed IDs, oversized lists and invalid pagination before database writes', async () => {
		const h = harness();
		for (const input of [
			{ page: 0, limit: 10 },
			{ page: 1, limit: 51 },
			{ page: 1.5, limit: 10 },
			{ page: 1000001, limit: 1 },
		]) {
			await expect(h.service.getNotifications(userId, input)).rejects.toBeInstanceOf(BadRequestException);
		}
		await expect(h.service.markNotificationRead(userId, 'bad')).rejects.toBeInstanceOf(BadRequestException);
		for (const ids of [[], Array(101).fill(String(messageId)), ['bad']]) {
			await expect(
				h.service.markMessageNotificationsRead(agentId, { conversationId: String(conversationId), messageIds: ids }),
			).rejects.toBeInstanceOf(BadRequestException);
		}
		expect(h.notifications.updateOne).not.toHaveBeenCalled();
	});

	it('contains notification database errors without exposing payloads or failing an already saved source event', async () => {
		const h = harness();
		const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		h.notifications.updateOne.mockImplementationOnce(() => ({
			exec: jest.fn().mockRejectedValue(new Error('PRIVATE_DATABASE_VALUE')),
		}));
		await expect(h.service.record(h.event)).resolves.toBeUndefined();
		expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_DATABASE_VALUE');
		log.mockRestore();
		const resolver = new NotificationResolver(h.service);
		jest.spyOn(h.service, 'getNotifications').mockRejectedValueOnce(new Error('PRIVATE_DATABASE_VALUE'));
		await expect(resolver.getNotifications({ req: { notificationMemberId: userId } }, page)).rejects.toEqual(
			new InternalServerErrorException('Notification operation failed'),
		);
	});
});

describe('Notification GraphQL authentication and contract', () => {
	it('requires bearer authentication and assigns only verified member identity', async () => {
		const req: any = { headers: {} };
		const context = jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({ getContext: () => ({ req }) } as any);
		const auth = { verifyToken: jest.fn().mockResolvedValue({ _id: userId }) };
		const guard = new NotificationGuard(auth as any);
		await expect(guard.canActivate({} as any)).rejects.toBeInstanceOf(UnauthorizedException);
		req.headers.authorization = 'Bearer verified-token';
		await expect(guard.canActivate({} as any)).resolves.toBe(true);
		expect(req.notificationMemberId).toBe(userId);
		auth.verifyToken.mockRejectedValueOnce(new Error('invalid'));
		await expect(guard.canActivate({} as any)).rejects.toBeInstanceOf(UnauthorizedException);
		context.mockRestore();
		expect(Reflect.getMetadata(GUARDS_METADATA, NotificationResolver)).toContain(NotificationGuard);
	});

	it('builds the actual GraphQL schema offline with no public create or receiver override', async () => {
		const module = await Test.createTestingModule({ imports: [GraphQLSchemaBuilderModule] }).compile();
		try {
			const schema = await module.get(GraphQLSchemaFactory).create([NotificationResolver]);
			const text = printSchema(schema);
			expect(Object.keys(schema.getQueryType()!.getFields())).toEqual(['getNotifications']);
			expect(Object.keys(schema.getMutationType()!.getFields()).sort()).toEqual(
				['markNotificationRead', 'markAllNotificationsRead', 'markMessageNotificationsRead'].sort(),
			);
			expect(text).not.toMatch(/receiverId|authorId|notificationDesc|eventKey/);
			expect(text).toContain('readBefore: DateTime!');
		} finally {
			await module.close();
		}
	});
});
