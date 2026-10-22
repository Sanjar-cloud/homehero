import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: jest.fn(() => 'offline-image') }));
import { EventEmitter } from 'events';
import { Subject, from } from 'rxjs';
import { WsAdapter } from '@nestjs/platform-ws';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import * as WebSocket from 'ws';
import { Types } from 'mongoose';
import { SocketGateway } from './socket.gateway';
import { MessageCreatedEvent } from '../components/messaging/messaging.service';

class OfflineSocket extends EventEmitter {
	readyState = WebSocket.OPEN;
	send = jest.fn((_payload: string, callback?: (error?: Error) => void) => callback?.());
	close = jest.fn(() => { this.readyState = WebSocket.CLOSED as any; });
}
const userId = new Types.ObjectId();
const agentId = new Types.ObjectId();
const otherUserId = new Types.ObjectId();
const otherAgentId = new Types.ObjectId();
const conversationId = new Types.ObjectId();
const otherConversationId = new Types.ObjectId();
const event: MessageCreatedEvent = {
	userId, agentId,
	message: { _id: new Types.ObjectId(), conversationId, senderId: userId, text: 'Private hello', serviceContext: null, createdAt: new Date() },
};
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function harness() {
	const events = new Subject<MessageCreatedEvent>();
	const auth = { verifyToken: jest.fn(async (token: string) => ({ _id: token, exp: Math.floor(Date.now() / 1000) + 60, memberPhone: 'PRIVATE_PHONE' })) };
	const messaging = {
		messageEvents: events.asObservable(),
		activeMember: jest.fn(async (id) => ({ _id: id })),
		authorizeDelivery: jest.fn(async (id, threadId) => {
			const pair = String(threadId) === String(conversationId) ? [userId, agentId] : [otherUserId, otherAgentId];
			if (!pair.some((member) => String(member) === String(id))) throw new Error('denied');
		}),
	};
	const notificationChanges = new Subject<string>();
	const notifications = { changes: notificationChanges.asObservable(), activeMember: jest.fn(async (id) => ({ _id: id })) };
	const gateway = new SocketGateway(auth as any, messaging as any, notifications as any);
	gateway.onModuleInit();
	const sockets: OfflineSocket[] = [];
	function connect() {
		const socket = new OfflineSocket(); sockets.push(socket); gateway.handleConnection(socket as any); return socket;
	}
	async function login(id: Types.ObjectId) {
		const socket = connect(); await gateway.authenticate(socket as any, { token: String(id) }); return socket;
	}
	return { gateway, events, auth, messaging, connect, login, sockets, notificationChanges, notifications };
}

describe('Private WebSocket gateway (no server/network/database)', () => {
	let h: ReturnType<typeof harness>;
	beforeEach(() => { jest.useFakeTimers(); h = harness(); });
	afterEach(() => { h.gateway.onModuleDestroy(); jest.useRealTimers(); });

	it('sends notification changes only to the receiver across tabs with no private event content', async () => {
		const first = await h.login(agentId); const second = await h.login(agentId); const other = await h.login(userId);
		h.notificationChanges.next(String(agentId)); await flush();
		for (const socket of [first, second]) expect(JSON.parse(socket.send.mock.calls[1][0])).toEqual({ event: 'notification:changed', data: { memberId: String(agentId) } });
		expect(other.send).toHaveBeenCalledTimes(1);
	});

	it('rechecks revoked accounts and token expiry before notification delivery', async () => {
		const revoked = await h.login(agentId);
		h.notifications.activeMember.mockRejectedValueOnce(new Error('blocked'));
		h.notificationChanges.next(String(agentId)); await flush();
		expect(revoked.close).toHaveBeenCalled(); expect(revoked.send).toHaveBeenCalledTimes(1);
		const expired = await h.login(userId);
		jest.advanceTimersByTime(61000);
		h.notificationChanges.next(String(userId)); await flush();
		expect(expired.close).toHaveBeenCalled(); expect(expired.send).toHaveBeenCalledTimes(1);
	});

	it('uses /ws and the installed adapter event/data authentication protocol offline', async () => {
		expect(Reflect.getMetadata(GATEWAY_OPTIONS, SocketGateway)).toEqual({ path: '/ws', maxPayload: 16 * 1024 });
		const socket = h.connect();
		const frame = { event: 'authenticate', data: { token: String(userId) } };
		// Only parse/dispatch is exercised: no HTTP server or application is started.
		const adapter = new WsAdapter();
		const handlers = new Map([['authenticate', { callback: (data) => h.gateway.authenticate(socket as any, data) }]]);
		await new Promise<void>((resolve, reject) => {
			(adapter as any).bindMessageHandler({ data: JSON.stringify(frame) }, handlers, (result) => from(result))
				.subscribe({ complete: resolve, error: reject });
		});
		expect(JSON.parse(socket.send.mock.calls[0][0]).event).toBe('connection:ready');
	});

	it('closes unauthenticated sockets after 10 seconds without guest events', () => {
		const socket = h.connect();
		expect(socket.send).not.toHaveBeenCalled();
		jest.advanceTimersByTime(10000);
		expect(socket.close).toHaveBeenCalledWith(1008, 'Authentication or access required');
	});
	it('authenticates a first-frame token and returns only its own member ID', async () => {
		const socket = await h.login(userId);
		expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ event: 'connection:ready', data: { memberId: String(userId) } });
		expect(JSON.stringify(socket.send.mock.calls)).not.toContain('PRIVATE_PHONE');
		jest.advanceTimersByTime(10000);
		expect(socket.close).not.toHaveBeenCalled();
	});
	it.each([null, {}, { token: '' }, { token: 7 }])('rejects malformed credentials %j', async (data) => {
		const socket = h.connect(); await h.gateway.authenticate(socket as any, data);
		expect(socket.close).toHaveBeenCalled(); expect(socket.send).not.toHaveBeenCalled();
	});
	it('rejects invalid tokens and inactive/ADMIN accounts', async () => {
		const invalid = h.connect(); h.auth.verifyToken.mockRejectedValueOnce(new Error('invalid'));
		await h.gateway.authenticate(invalid as any, { token: 'invalid' });
		expect(invalid.close).toHaveBeenCalled();
		const inactive = h.connect(); h.messaging.activeMember.mockRejectedValueOnce(new Error('denied'));
		await h.gateway.authenticate(inactive as any, { token: String(userId) });
		expect(inactive.close).toHaveBeenCalled(); expect(inactive.send).not.toHaveBeenCalled();
	});
	it('rejects expired tokens before account lookup', async () => {
		const socket = h.connect();
		h.auth.verifyToken.mockResolvedValueOnce({ _id: String(userId), exp: Math.floor(Date.now() / 1000) - 1, memberPhone: '' });
		await h.gateway.authenticate(socket as any, { token: 'expired' });
		expect(socket.close).toHaveBeenCalled(); expect(h.messaging.activeMember).not.toHaveBeenCalled();
	});
	it.each(['not-json', JSON.stringify({ event: 'message', data: 'secret' }), JSON.stringify({ event: 'join', data: String(conversationId) })])('rejects malformed or legacy first frame', (frame) => {
		const socket = h.connect(); socket.emit('message', Buffer.from(frame));
		expect(socket.close).toHaveBeenCalled(); expect(socket.send).not.toHaveBeenCalled();
	});
	it('prevents late async authentication from resurrecting a timed-out socket', async () => {
		const socket = h.connect(); let resolve: (value: any) => void;
		h.auth.verifyToken.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
		const pending = h.gateway.authenticate(socket as any, { token: String(userId) });
		jest.advanceTimersByTime(10000);
		resolve({ _id: userId, exp: Math.floor(Date.now() / 1000) + 60 }); await pending;
		expect(socket.send).not.toHaveBeenCalled();
	});
	it('delivers only to both participants, across tabs, and isolates another conversation', async () => {
		const userTab1 = await h.login(userId); const userTab2 = await h.login(userId);
		const agent = await h.login(agentId); const otherUser = await h.login(otherUserId); const otherAgent = await h.login(otherAgentId);
		for (const socket of h.sockets) socket.send.mockClear();
		h.events.next(event); await flush();
		for (const socket of [userTab1, userTab2, agent]) expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual(JSON.parse(JSON.stringify({ event: 'message:new', data: event.message })));
		expect(otherUser.send).not.toHaveBeenCalled(); expect(otherAgent.send).not.toHaveBeenCalled();
		for (const socket of h.sockets) socket.send.mockClear();
		h.events.next({ userId: otherUserId, agentId: otherAgentId, message: { ...event.message, conversationId: otherConversationId } }); await flush();
		expect(otherUser.send).toHaveBeenCalledTimes(1); expect(otherAgent.send).toHaveBeenCalledTimes(1);
		for (const socket of [userTab1, userTab2, agent]) expect(socket.send).not.toHaveBeenCalled();
	});
	it('rechecks participant access and closes a socket whose current permissions changed', async () => {
		const user = await h.login(userId); const agent = await h.login(agentId);
		user.send.mockClear(); agent.send.mockClear();
		h.messaging.authorizeDelivery.mockImplementation(async (id) => { if (String(id) === String(userId)) throw new Error('blocked or role changed'); });
		h.events.next(event); await flush();
		expect(user.close).toHaveBeenCalled(); expect(user.send).not.toHaveBeenCalled(); expect(agent.send).toHaveBeenCalledTimes(1);
		expect(h.messaging.authorizeDelivery).toHaveBeenCalledWith(String(userId), conversationId);
	});
	it('rechecks token expiry during delivery', async () => {
		const socket = await h.login(userId); socket.send.mockClear();
		jest.advanceTimersByTime(61000); h.events.next(event); await flush();
		expect(socket.close).toHaveBeenCalled(); expect(socket.send).not.toHaveBeenCalled();
	});
	it('cleans disconnected sockets while preserving other tabs', async () => {
		const first = await h.login(userId); const second = await h.login(userId);
		first.send.mockClear(); second.send.mockClear(); h.gateway.handleDisconnect(first as any);
		h.events.next(event); await flush();
		expect(first.send).not.toHaveBeenCalled(); expect(second.send).toHaveBeenCalledTimes(1);
	});
	it('does not propagate delivery errors to the persisted-message event source', async () => {
		const socket = await h.login(userId); socket.send.mockImplementationOnce(() => { throw new Error('offline send failure'); });
		expect(() => h.events.next(event)).not.toThrow(); await flush();
		expect(socket.close).toHaveBeenCalled();
	});
	it('rejects authenticated client attempts to write messages over WebSocket', async () => {
		const socket = await h.login(userId); socket.send.mockClear();
		socket.emit('message', Buffer.from(JSON.stringify({ event: 'message', data: 'private' })));
		expect(socket.close).toHaveBeenCalled(); expect(socket.send).not.toHaveBeenCalled();
	});
	it('unsubscribes and clears auth deadlines on module shutdown', () => {
		const socket = h.connect(); h.gateway.onModuleDestroy();
		expect(socket.close).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(10000); expect(socket.close).toHaveBeenCalledTimes(1);
	});
});
