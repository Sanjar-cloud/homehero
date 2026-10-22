import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Subscription } from 'rxjs';
import { AuthService } from '../components/auth/auth.service';
import { MessageCreatedEvent, MessagingService } from '../components/messaging/messaging.service';

import { NotificationService } from '../components/notification/notification.service';

interface SocketSession { memberId: string; expiresAt: number }

@WebSocketGateway({ path: '/ws', maxPayload: 16 * 1024 })
export class SocketGateway implements OnModuleInit, OnModuleDestroy {
	private readonly sessions = new Map<WebSocket, SocketSession>();
	private readonly memberSockets = new Map<string, Set<WebSocket>>();
	private readonly pending = new Map<WebSocket, ReturnType<typeof setTimeout>>();
	private readonly authenticating = new Set<WebSocket>();
	private subscription: Subscription;
	private notificationSubscription: Subscription;

	constructor(private readonly auth: AuthService, private readonly messaging: MessagingService, private readonly notifications: NotificationService) {}

	onModuleInit() {
		this.notificationSubscription = this.notifications.changes.subscribe((memberId) => {
			void this.notify(memberId).catch(() => undefined);
		});
		this.subscription = this.messaging.messageEvents.subscribe((event) => {
			// Delivery is best effort; persistence has already succeeded.
			void this.deliver(event).catch(() => undefined);
		});
	}
	onModuleDestroy() {
		this.subscription?.unsubscribe();
		this.notificationSubscription?.unsubscribe();
		for (const client of [...this.pending.keys(), ...this.sessions.keys()]) this.close(client);
	}
	handleConnection(client: WebSocket) {
		this.pending.set(client, setTimeout(() => this.close(client), 10000));
		// Only authentication is accepted from clients. Reject malformed/legacy frames.
		client.on('message', (raw) => {
			try {
				const frame = JSON.parse(raw.toString());
				if (frame?.event !== 'authenticate' || this.sessions.has(client)) this.close(client);
			} catch { this.close(client); }
		});
	}
	handleDisconnect(client: WebSocket) {
		clearTimeout(this.pending.get(client));
		this.pending.delete(client);
		this.authenticating.delete(client);
		const session = this.sessions.get(client);
		if (session) {
			const sockets = this.memberSockets.get(session.memberId);
			sockets?.delete(client);
			if (!sockets?.size) this.memberSockets.delete(session.memberId);
		}
		this.sessions.delete(client);
	}
	private close(client: WebSocket) {
		this.handleDisconnect(client);
		client.close(1008, 'Authentication or access required');
	}

	@SubscribeMessage('authenticate')
	async authenticate(client: WebSocket, data: unknown): Promise<void> {
		if (!this.pending.has(client) || this.authenticating.has(client)) { this.close(client); return; }
		this.authenticating.add(client);
		try {
			const token = (data as { token?: unknown })?.token;
			if (typeof token !== 'string' || !token) throw new Error();
			const claims = await this.auth.verifyToken(token) as any;
			if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error();
			const member = await this.messaging.activeMember(claims._id);
			// A timeout/disconnect during async authentication must not resurrect a socket.
			if (!this.pending.has(client) || client.readyState !== WebSocket.OPEN) return;
			const memberId = String(member._id);
			this.sessions.set(client, { memberId, expiresAt: claims.exp * 1000 });
			const sockets = this.memberSockets.get(memberId) ?? new Set<WebSocket>();
			sockets.add(client);
			this.memberSockets.set(memberId, sockets);
			clearTimeout(this.pending.get(client));
			this.pending.delete(client);
			client.send(JSON.stringify({ event: 'connection:ready', data: { memberId } }));
		} catch { this.close(client); }
		finally { this.authenticating.delete(client); }
	}

	private async notify(memberId: string): Promise<void> {
		const sockets = [...(this.memberSockets.get(memberId) ?? [])];
		if (!sockets.length) return;
		try { await this.notifications.activeMember(memberId); }
		catch { for (const client of sockets) this.close(client); return; }
		for (const client of sockets) {
			const session = this.sessions.get(client);
			if (!session) continue;
			if (session.expiresAt <= Date.now()) { this.close(client); continue; }
			if (client.readyState !== WebSocket.OPEN) { this.handleDisconnect(client); continue; }
			try {
				client.send(JSON.stringify({ event: 'notification:changed', data: { memberId } }), (error) => {
					if (error) this.close(client);
				});
			} catch { this.close(client); }
		}
	}

	private async deliver(event: MessageCreatedEvent): Promise<void> {
		await Promise.all([event.userId, event.agentId].map(async (id) => {
			const memberId = String(id);
			const sockets = [...(this.memberSockets.get(memberId) ?? [])];
			if (!sockets.length) return;
			try { await this.messaging.authorizeDelivery(memberId, event.message.conversationId); }
			catch { for (const client of sockets) this.close(client); return; }
			for (const client of sockets) {
				const session = this.sessions.get(client);
				if (!session) continue;
				if (session.expiresAt <= Date.now()) { this.close(client); continue; }
				if (client.readyState !== WebSocket.OPEN) { this.handleDisconnect(client); continue; }
				try {
					client.send(JSON.stringify({ event: 'message:new', data: event.message }), (error) => {
						if (error) this.close(client);
					});
				} catch { this.close(client); }
			}
		}));
	}
}
