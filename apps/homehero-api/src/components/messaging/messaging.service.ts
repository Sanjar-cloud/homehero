import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { Model, Types } from 'mongoose';
import type { ObjectId } from 'mongoose';
import { Subject } from 'rxjs';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { ChatMessage, Conversation, Conversations, Messages, MessageServiceContext } from '../../libs/dto/messaging/messaging';
import { ConversationsInquiry, MessagesInquiry, SendMessageInput, StartConversationInput } from '../../libs/dto/messaging/messaging.input';
import { ServiceService } from '../service/service.service';

interface MessagingMember {
	_id: Types.ObjectId;
	memberType: MemberType;
	memberStatus: MemberStatus;
}
export interface MessageCreatedEvent {
	message: ChatMessage;
	userId: Types.ObjectId;
	agentId: Types.ObjectId;
}
const memberProjection = { _id: 1, memberNick: 1, memberImage: 1 };
const messageProjection = { _id: 1, conversationId: 1, senderId: 1, text: 1, serviceContext: 1, createdAt: 1 };

import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MessagingService {
	private readonly messageCreated = new Subject<MessageCreatedEvent>();
	readonly messageEvents = this.messageCreated.asObservable();

	constructor(
		@InjectModel('Conversation') private readonly conversationModel: Model<Conversation>,
		@InjectModel('Message') private readonly messageModel: Model<ChatMessage>,
		@InjectModel('Member') private readonly memberModel: Model<MessagingMember>,
		private readonly serviceService: ServiceService,
		private readonly notifications: NotificationService,
	) {}

	private denied(): never {
		throw new ForbiddenException('Conversation unavailable');
	}

	private id(value: unknown): Types.ObjectId {
		const text = value instanceof Types.ObjectId ? value.toHexString() : value;
		if (typeof text !== 'string' || !isMongoId(text)) {
			throw new BadRequestException('Invalid ID');
		}
		return new Types.ObjectId(text);
	}

	private pagination(input: ConversationsInquiry): void {
		if (
			!Number.isSafeInteger(input.page) || input.page < 1 ||
			!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100 ||
			!Number.isSafeInteger((input.page - 1) * input.limit)
		) {
			throw new BadRequestException('Invalid pagination');
		}
	}

	public async activeMember(memberId: unknown): Promise<MessagingMember> {
		const member = await this.memberModel
			.findOne({ _id: this.id(memberId) })
			.select('_id memberType memberStatus')
			.lean()
			.exec();
		if (!member || member.memberStatus !== MemberStatus.ACTIVE || ![MemberType.USER, MemberType.AGENT].includes(member.memberType)) {
			this.denied();
		}
		return member;
	}

	private participantPredicate(member: MessagingMember) {
		return member.memberType === MemberType.USER ? { userId: member._id } : { agentId: member._id };
	}

	private async authorizedConversation(member: MessagingMember, conversationId: unknown): Promise<Conversation> {
		const conversation = await this.conversationModel
			.findOne({ _id: this.id(conversationId), ...this.participantPredicate(member) })
			.lean()
			.exec();
		if (!conversation) this.denied();
		return conversation;
	}

	public async authorizeDelivery(memberId: unknown, conversationId: unknown): Promise<void> {
		await this.authorizedConversation(await this.activeMember(memberId), conversationId);
	}

	private providerLookup(field: string, alias: string) {
		return {
			$lookup: {
				from: 'members',
				let: { participantId: `$${field}` },
				pipeline: [
					{ $match: { $expr: { $eq: ['$_id', '$$participantId'] } } },
					{ $project: memberProjection },
				],
				as: alias,
			},
		};
	}

	private conversationPipeline(match: object) {
		return [
			{ $match: match },
			{
				$lookup: {
					from: 'messages',
					let: { threadId: '$_id' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$conversationId', '$$threadId'] } } },
						{ $sort: { createdAt: -1, _id: -1 } },
						{ $limit: 1 },
						{ $project: messageProjection },
					],
					as: 'latest',
				},
			},
			{
				$set: {
					lastMessage: { $ifNull: [{ $arrayElemAt: ['$latest', 0] }, null] },
					activityAt: { $ifNull: [{ $arrayElemAt: ['$latest.createdAt', 0] }, '$createdAt'] },
				},
			},
		];
	}

	private enrichPipeline() {
		return [
			this.providerLookup('userId', 'userProfile'),
			this.providerLookup('agentId', 'agentProfile'),
			{
				$project: {
					_id: 1,
					userId: 1,
					agentId: 1,
					createdAt: 1,
					updatedAt: 1,
					activityAt: 1,
					lastMessage: 1,
					userData: { $ifNull: [{ $arrayElemAt: ['$userProfile', 0] }, null] },
					agentData: { $ifNull: [{ $arrayElemAt: ['$agentProfile', 0] }, null] },
				},
			},
		];
	}

	public async startConversation(memberId: unknown, input: StartConversationInput): Promise<Conversation> {
		const member = await this.activeMember(memberId);
		if (member.memberType !== MemberType.USER) this.denied();
		const service = await this.serviceService.assertServiceVisible(this.id(input.serviceId) as unknown as ObjectId);
		const agent = await this.activeMember(service.memberId);
		if (agent.memberType !== MemberType.AGENT) this.denied();
		const pair = { userId: member._id, agentId: agent._id };
		let conversation: Conversation | null;
		try {
			conversation = await this.conversationModel
				.findOneAndUpdate(
					pair,
					{ $setOnInsert: pair },
					{ upsert: true, new: true, runValidators: true },
				)
				.lean()
				.exec();
		} catch (error) {
			if (error?.code !== 11000) throw error;
			conversation = await this.conversationModel
				.findOne(pair)
				.lean()
				.exec();
			if (!conversation) this.denied();
		}
		if (!conversation) this.denied();
		const [output] = await this.conversationModel.aggregate<Conversation>([
			...this.conversationPipeline({ _id: conversation._id, ...pair }),
			...this.enrichPipeline(),
		] as any).exec();
		if (!output) this.denied();
		return output;
	}

	public async getConversations(memberId: unknown, input: ConversationsInquiry): Promise<Conversations> {
		this.pagination(input);
		const member = await this.activeMember(memberId);
		const [result] = await this.conversationModel.aggregate<Conversations>([
			{ $match: this.participantPredicate(member) },
			{
				$facet: {
					list: [
						...this.conversationPipeline({}),
						{ $sort: { activityAt: -1, _id: -1 } },
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						...this.enrichPipeline(),
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		] as any).exec();
		return result ?? { list: [], metaCounter: [] };
	}

	public async getMessages(memberId: unknown, input: MessagesInquiry): Promise<Messages> {
		this.pagination(input);
		const member = await this.activeMember(memberId);
		const conversation = await this.authorizedConversation(member, input.conversationId);
		const [result] = await this.messageModel.aggregate<Messages>([
			{ $match: { conversationId: conversation._id } },
			{
				$facet: {
					list: [
						{ $sort: { createdAt: -1, _id: -1 } },
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						{ $project: messageProjection },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]).exec();
		return result ?? { list: [], metaCounter: [] };
	}

	public async sendMessage(memberId: unknown, input: SendMessageInput): Promise<ChatMessage> {
		if (typeof input.text !== 'string' || input.text.trim().length < 1 || input.text.trim().length > 2000) {
			throw new BadRequestException('Invalid message text');
		}
		const member = await this.activeMember(memberId);
		const conversation = await this.authorizedConversation(member, input.conversationId);
		const [user, agent] = await Promise.all([
			this.activeMember(conversation.userId),
			this.activeMember(conversation.agentId),
		]);
		if (user.memberType !== MemberType.USER || agent.memberType !== MemberType.AGENT) this.denied();
		let serviceContext: MessageServiceContext | null = null;
		if (input.serviceId != null) {
			if (member.memberType !== MemberType.USER) this.denied();
			const service = await this.serviceService.assertServiceVisible(this.id(input.serviceId) as unknown as ObjectId);
			if (String(service.memberId) !== String(conversation.agentId)) this.denied();
			serviceContext = { serviceId: this.id(service._id), serviceTitle: service.serviceTitle };
		}
		const saved = await this.messageModel.create({
			conversationId: conversation._id,
			senderId: member._id,
			text: input.text.trim(),
			serviceContext,
		});
		const message: ChatMessage = {
			_id: saved._id,
			conversationId: saved.conversationId,
			senderId: saved.senderId,
			text: saved.text,
			serviceContext: saved.serviceContext,
			createdAt: saved.createdAt,
		};
		const receiverId = String(member._id) === String(conversation.userId) ? conversation.agentId : conversation.userId;
		await this.notifications.record(this.notifications.messageEvent(message, receiverId));
		this.messageCreated.next({ message, userId: conversation.userId, agentId: conversation.agentId });
		return message;
	}
}
