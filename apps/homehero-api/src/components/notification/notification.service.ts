import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { NotificationGroup, NotificationStatus, NotificationType } from '../../libs/enums/notification.enum';
import { ServiceStatus } from '../../libs/enums/service.enum';
import { ChatMessage, Conversation } from '../../libs/dto/messaging/messaging';
import { Notification, Notifications } from '../../libs/dto/notification/notification';
import { NotificationsInquiry, ReadMessageNotificationsInput } from '../../libs/dto/notification/notification.input';

interface NotificationMember {
	_id: Types.ObjectId;
	memberNick: string;
	memberType: MemberType;
	memberStatus: MemberStatus;
}
interface NotificationEvent {
	eventKey: string;
	notificationType: NotificationType;
	notificationGroup: NotificationGroup;
	notificationTitle: string;
	authorId: unknown;
	receiverId: unknown;
	conversationId?: unknown;
	messageId?: unknown;
	supportRequestId?: unknown;
	serviceId?: unknown;
	serviceStatus?: ServiceStatus;
}
const supportedTypes = [NotificationType.MESSAGE, NotificationType.SUPPORT_REPLY, NotificationType.SERVICE_STATUS];

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);
	private readonly changed = new Subject<string>();
	readonly changes = this.changed.asObservable();

	constructor(
		@InjectModel('Notification') private readonly notifications: Model<Notification>,
		@InjectModel('Member') private readonly members: Model<NotificationMember>,
		@InjectModel('Conversation') private readonly conversations: Model<Conversation>,
		@InjectModel('Message') private readonly messages: Model<ChatMessage>,
	) {}

	private id(value: unknown): Types.ObjectId {
		const text = value instanceof Types.ObjectId ? String(value) : value;
		if (typeof text !== 'string' || !isMongoId(text)) throw new BadRequestException('Invalid notification ID');
		return new Types.ObjectId(text);
	}

	public async activeMember(memberId: unknown) {
		const member = await this.members
			.findOne({ _id: this.id(memberId) })
			.select('_id memberNick memberType memberStatus')
			.lean()
			.exec();
		if (
			!member ||
			member.memberStatus !== MemberStatus.ACTIVE ||
			![MemberType.USER, MemberType.AGENT].includes(member.memberType)
		) {
			throw new ForbiddenException('Notification access denied');
		}
		return member;
	}

	private own(receiverId: Types.ObjectId) {
		return { receiverId, notificationType: { $in: supportedTypes }, receiptOnly: { $ne: true } };
	}

	// Source operations have already succeeded. Notification failures must not invite duplicate retries.
	public async record(event: NotificationEvent): Promise<void> {
		try {
			await this.persist(event);
		} catch {
			this.logger.warn('Notification persistence failed; source operation remains saved');
		}
	}

	private async persist(event: NotificationEvent, read = false): Promise<void> {
		const receiver = await this.activeMember(event.receiverId);
		if (String(receiver._id) === String(event.authorId)) return;
		const author = await this.members
			.findOne({ _id: this.id(event.authorId) })
			.select('memberNick')
			.lean()
			.exec();
		const data: Record<string, unknown> = {
			...event,
			authorId: this.id(event.authorId),
			receiverId: receiver._id,
			receiptOnly: read,
			createdAt: new Date(),
			updatedAt: new Date(),
			authorNick: author?.memberNick ?? '',
			notificationStatus: read ? NotificationStatus.READ : NotificationStatus.WAIT,
		};
		for (const key of ['conversationId', 'messageId', 'supportRequestId', 'serviceId']) {
			if (data[key] != null) data[key] = this.id(data[key]);
		}
		const match = { eventKey: event.eventKey, receiverId: receiver._id };
		const update: any = { $setOnInsert: data };
		if (!read) {
			delete data.receiptOnly;
			update.$set = { receiptOnly: false };
		}
		if (read) {
			delete data.notificationStatus;
			update.$set = { notificationStatus: NotificationStatus.READ };
		}
		// Model.init() is cached by Mongoose and waits for the unique index on first use.
		await this.notifications.init();
		let result;
		try {
			result = await this.notifications
				.updateOne(match, update, { upsert: true, runValidators: true, timestamps: false })
				.exec();
		} catch (error) {
			if (error?.code !== 11000) throw error;
			// A concurrent insert won. Preserve READ or reveal the winning hidden receipt, respectively.
			result = await this.notifications
				.updateOne(
					match,
					{ $set: read ? { notificationStatus: NotificationStatus.READ } : { receiptOnly: false } },
					{ timestamps: false },
				)
				.exec();
		}
		if (result.upsertedCount || result.modifiedCount) this.changed.next(String(receiver._id));
	}

	public messageEvent(
		message: { _id: unknown; conversationId: unknown; senderId: unknown },
		receiverId: unknown,
	): NotificationEvent {
		return {
			eventKey: `message:${String(message._id)}`,
			notificationType: NotificationType.MESSAGE,
			notificationGroup: NotificationGroup.MEMBER,
			notificationTitle: 'New message',
			authorId: message.senderId,
			receiverId,
			messageId: message._id,
			conversationId: message.conversationId,
		};
	}

	public async getNotifications(memberId: unknown, input: NotificationsInquiry): Promise<Notifications> {
		if (
			!Number.isInteger(input.page) ||
			input.page < 1 ||
			input.page > 1000000 ||
			!Number.isInteger(input.limit) ||
			input.limit < 1 ||
			input.limit > 50
		)
			throw new BadRequestException('Invalid notification pagination');
		const member = await this.activeMember(memberId);
		const readBefore = new Date();
		const match = this.own(member._id);
		const [list, total, unreadCount] = await Promise.all([
			this.notifications
				.find(match)
				.sort({ createdAt: -1, _id: -1 })
				.skip((input.page - 1) * input.limit)
				.limit(input.limit)
				.lean()
				.exec(),
			this.notifications.countDocuments(match).exec(),
			this.notifications.countDocuments({ ...match, notificationStatus: NotificationStatus.WAIT }).exec(),
		]);
		return { list, total, unreadCount, readBefore };
	}

	public async markNotificationRead(memberId: unknown, notificationId: string): Promise<boolean> {
		const member = await this.activeMember(memberId);
		const result = await this.notifications
			.updateOne(
				{ ...this.own(member._id), _id: this.id(notificationId), notificationStatus: NotificationStatus.WAIT },
				{ $set: { notificationStatus: NotificationStatus.READ } },
			)
			.exec();
		if (result.modifiedCount) this.changed.next(String(member._id));
		return true;
	}

	public async markAllNotificationsRead(memberId: unknown, before: Date): Promise<boolean> {
		const member = await this.activeMember(memberId);
		if (!(before instanceof Date) || !Number.isFinite(before.getTime()) || before.getTime() > Date.now()) {
			throw new BadRequestException('Invalid notification cutoff');
		}
		const result = await this.notifications
			.updateMany(
				{ ...this.own(member._id), createdAt: { $lte: before }, notificationStatus: NotificationStatus.WAIT },
				{ $set: { notificationStatus: NotificationStatus.READ } },
			)
			.exec();
		if (result.modifiedCount) this.changed.next(String(member._id));
		return true;
	}

	public async markMessageNotificationsRead(memberId: unknown, input: ReadMessageNotificationsInput): Promise<boolean> {
		const member = await this.activeMember(memberId);
		if (!Array.isArray(input.messageIds) || input.messageIds.length < 1 || input.messageIds.length > 100) {
			throw new BadRequestException('Invalid message IDs');
		}
		const conversationId = this.id(input.conversationId);
		const messageIds = [...new Set(input.messageIds.map((id) => String(this.id(id))))].map((id) => this.id(id));
		const participant = member.memberType === MemberType.USER ? { userId: member._id } : { agentId: member._id };
		const conversation = await this.conversations
			.findOne({ _id: conversationId, ...participant })
			.lean()
			.exec();
		if (!conversation) throw new ForbiddenException('Conversation unavailable');
		const senderId = member.memberType === MemberType.USER ? conversation.agentId : conversation.userId;
		const messages = await this.messages
			.find({ _id: { $in: messageIds }, conversationId, senderId })
			.select('_id conversationId senderId')
			.lean()
			.exec();
		// Hidden READ receipts prevent delayed producers from reviving unread state.
		// Older messages without a notification stay out of the inbox (no historical backfill).
		for (const message of messages) await this.persist(this.messageEvent(message, member._id), true);
		return true;
	}
}
