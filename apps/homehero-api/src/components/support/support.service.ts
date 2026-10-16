import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Member } from '../../libs/dto/member/member';
import { SupportNotice, SupportNotices, SupportRequest, SupportRequests } from '../../libs/dto/support/support';
import {
	AdminSupportNoticesInquiry,
	CreateSupportNoticeInput,
	CreateSupportRequestInput,
	ReplySupportRequestInput,
	SupportNoticesInquiry,
	SupportPagination,
	SupportRequestsInquiry,
	SupportTranslationsInput,
	UpdateSupportNoticeInput,
} from '../../libs/dto/support/support.input';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { NoticeCategory, NoticeStatus } from '../../libs/enums/notice.enum';
import { SupportRequestStatus } from '../../libs/enums/support.enum';

@Injectable()
export class SupportService {
	constructor(
		@InjectModel('Notice') private readonly noticeModel: Model<SupportNotice>,
		@InjectModel('SupportRequest') private readonly requestModel: Model<SupportRequest>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

	private id(value: unknown): Types.ObjectId {
		const text = value instanceof Types.ObjectId ? value.toHexString() : value;
		if (typeof text !== 'string' || !isMongoId(text)) throw new BadRequestException('Invalid support ID');
		return new Types.ObjectId(text);
	}

	private async activeMember(memberId: unknown, roles: MemberType[]): Promise<Types.ObjectId> {
		if (!memberId) throw new UnauthorizedException('Authentication required');
		const id = this.id(memberId);
		const member = await this.memberModel.findOne({ _id: id }).select('_id memberType memberStatus').lean().exec();
		if (!member || member.memberStatus !== MemberStatus.ACTIVE || !roles.includes(member.memberType)) {
			throw new ForbiddenException('Support access denied');
		}
		return id;
	}

	private text(value: unknown, minimum: number, maximum: number): string {
		if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
			throw new BadRequestException(`Text must contain ${minimum}–${maximum} characters`);
		}
		return value.trim();
	}

	private pagination(input: SupportPagination): void {
		if (!Number.isInteger(input.page) || input.page < 1 || input.page > 2147483647 ||
			!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
			throw new BadRequestException('Invalid support pagination');
		}
	}

	private category(value: NoticeCategory): NoticeCategory {
		if (![NoticeCategory.FAQ, NoticeCategory.ANNOUNCEMENT].includes(value)) {
			throw new BadRequestException('Invalid support category');
		}
		return value;
	}

	private noticeStatus(value: NoticeStatus = NoticeStatus.HOLD): NoticeStatus {
		if (![NoticeStatus.HOLD, NoticeStatus.ACTIVE].includes(value)) {
			throw new BadRequestException('Invalid support notice status');
		}
		return value;
	}

	private translations(input?: SupportTranslationsInput | null): SupportTranslationsInput | null {
		if (input == null) return null;
		if (typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid support translations');
		const result: SupportTranslationsInput = {};
		for (const locale of ['kr', 'ru'] as const) {
			const value = input[locale];
			if (value != null) {
				result[locale] = { title: this.text(value.title, 3, 100), content: this.text(value.content, 1, 5000) };
			}
		}
		return result;
	}

	public async createSupportNotice(memberId: unknown, input: CreateSupportNoticeInput): Promise<SupportNotice> {
		const authorId = await this.activeMember(memberId, [MemberType.ADMIN]);
		return this.noticeModel.create({
			memberId: authorId,
			noticeCategory: this.category(input.noticeCategory),
			noticeStatus: this.noticeStatus(input.noticeStatus),
			noticeTitle: this.text(input.noticeTitle, 3, 100),
			noticeContent: this.text(input.noticeContent, 1, 5000),
			translations: this.translations(input.translations),
		});
	}

	public async updateSupportNotice(memberId: unknown, input: UpdateSupportNoticeInput): Promise<SupportNotice> {
		await this.activeMember(memberId, [MemberType.ADMIN]);
		const update = {
			noticeTitle: this.text(input.noticeTitle, 3, 100),
			noticeContent: this.text(input.noticeContent, 1, 5000),
			noticeStatus: this.noticeStatus(input.noticeStatus),
			...(input.translations !== undefined ? { translations: this.translations(input.translations) } : {}),
		};
		const notice = await this.noticeModel.findOneAndUpdate(
			{
				_id: this.id(input._id),
				noticeCategory: { $in: [NoticeCategory.FAQ, NoticeCategory.ANNOUNCEMENT] },
				noticeStatus: { $in: [NoticeStatus.HOLD, NoticeStatus.ACTIVE] },
			},
			{ $set: update },
			{ new: true, runValidators: true },
		).lean().exec();
		if (!notice) throw new NotFoundException('Support notice unavailable');
		return notice;
	}

	private async notices(input: SupportNoticesInquiry, statuses: NoticeStatus[]): Promise<SupportNotices> {
		this.pagination(input);
		const match: Record<string, unknown> = {
			noticeCategory: this.category(input.noticeCategory),
			noticeStatus: { $in: statuses },
		};
		if (input.text != null && input.text !== '') {
			const text = this.text(input.text, 1, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			match.$or = ['noticeTitle', 'noticeContent', 'translations.kr.title', 'translations.kr.content', 'translations.ru.title', 'translations.ru.content']
				.map((field) => ({ [field]: { $regex: text, $options: 'i' } }));
		}
		const result = await this.noticeModel.aggregate<SupportNotices>([
			{ $match: match },
			{ $sort: { createdAt: -1, _id: -1 } },
			{
				$facet: {
					list: [
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						{ $project: { _id: 1, noticeCategory: 1, noticeStatus: 1, noticeTitle: 1, noticeContent: 1, translations: 1, createdAt: 1, updatedAt: 1 } },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]).exec();
		const page = result[0] ?? { list: [], metaCounter: [] };
		return { list: page.list, metaCounter: page.metaCounter.length ? page.metaCounter : [{ total: 0 }] };
	}

	public getSupportNotices(input: SupportNoticesInquiry): Promise<SupportNotices> {
		return this.notices(input, [NoticeStatus.ACTIVE]);
	}

	public async getSupportNoticesByAdmin(memberId: unknown, input: AdminSupportNoticesInquiry): Promise<SupportNotices> {
		await this.activeMember(memberId, [MemberType.ADMIN]);
		const statuses = input.noticeStatus == null ? [NoticeStatus.HOLD, NoticeStatus.ACTIVE] : [this.noticeStatus(input.noticeStatus)];
		return this.notices(input, statuses);
	}

	public async createSupportRequest(memberId: unknown, input: CreateSupportRequestInput): Promise<SupportRequest> {
		const ownerId = await this.activeMember(memberId, [MemberType.USER, MemberType.AGENT]);
		return this.requestModel.create({
			memberId: ownerId,
			subject: this.text(input.subject, 3, 100),
			content: this.text(input.content, 1, 2000),
			status: SupportRequestStatus.OPEN,
		});
	}

	private async requests(input: SupportRequestsInquiry, ownerId?: Types.ObjectId): Promise<SupportRequests> {
		this.pagination(input);
		if (input.status != null && !Object.values(SupportRequestStatus).includes(input.status)) {
			throw new BadRequestException('Invalid support request status');
		}
		const match = {
			...(ownerId ? { memberId: ownerId } : {}),
			...(input.status ? { status: input.status } : {}),
		};
		const result = await this.requestModel.aggregate<SupportRequests>([
			{ $match: match },
			{ $sort: { createdAt: -1, _id: -1 } },
			{
				$facet: {
					list: [
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						{
							$lookup: {
								from: 'members',
								let: { memberId: '$memberId' },
								pipeline: [
									{ $match: { $expr: { $eq: ['$_id', '$$memberId'] } } },
									{ $project: { _id: 1, memberNick: 1, memberType: 1 } },
								],
								as: 'memberData',
							},
						},
						{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
						{ $project: { _id: 1, memberId: 1, subject: 1, content: 1, status: 1, reply: 1, adminId: 1, repliedAt: 1, createdAt: 1, updatedAt: 1, memberData: 1 } },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]).exec();
		const page = result[0] ?? { list: [], metaCounter: [] };
		return { list: page.list, metaCounter: page.metaCounter.length ? page.metaCounter : [{ total: 0 }] };
	}

	public async getMySupportRequests(memberId: unknown, input: SupportRequestsInquiry): Promise<SupportRequests> {
		const ownerId = await this.activeMember(memberId, [MemberType.USER, MemberType.AGENT]);
		return this.requests(input, ownerId);
	}

	public async getSupportRequestsByAdmin(memberId: unknown, input: SupportRequestsInquiry): Promise<SupportRequests> {
		await this.activeMember(memberId, [MemberType.ADMIN]);
		return this.requests({ ...input, status: input.status ?? SupportRequestStatus.OPEN });
	}

	public async replySupportRequest(memberId: unknown, input: ReplySupportRequestInput): Promise<SupportRequest> {
		const adminId = await this.activeMember(memberId, [MemberType.ADMIN]);
		// The OPEN predicate is atomic: a second admin can never overwrite the first reply.
		const request = await this.requestModel.findOneAndUpdate(
			{ _id: this.id(input._id), status: SupportRequestStatus.OPEN, reply: null },
			{ $set: { reply: this.text(input.reply, 1, 2000), adminId, repliedAt: new Date(), status: SupportRequestStatus.ANSWERED } },
			{ new: true, runValidators: true },
		).lean().exec();
		if (!request) throw new ConflictException('Support request unavailable or already answered');
		return request;
	}
}
