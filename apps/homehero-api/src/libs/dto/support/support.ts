import { Field, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from 'mongoose';
import { TotalCounter } from '../member/member';
import { NoticeCategory, NoticeStatus } from '../../enums/notice.enum';
import { MemberType } from '../../enums/member.enum';
import { SupportRequestStatus } from '../../enums/support.enum';

@ObjectType()
export class SupportTranslation {
	@Field(() => String)
	title: string;

	@Field(() => String)
	content: string;
}

@ObjectType()
export class SupportTranslations {
	@Field(() => SupportTranslation, { nullable: true })
	kr?: SupportTranslation | null;

	@Field(() => SupportTranslation, { nullable: true })
	ru?: SupportTranslation | null;
}

@ObjectType()
export class SupportNotice {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@Field(() => NoticeStatus)
	noticeStatus: NoticeStatus;

	@Field(() => String)
	noticeTitle: string;

	@Field(() => String)
	noticeContent: string;

	@Field(() => SupportTranslations, { nullable: true })
	translations?: SupportTranslations | null;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class SupportNotices {
	@Field(() => [SupportNotice])
	list: SupportNotice[];

	@Field(() => [TotalCounter])
	metaCounter: TotalCounter[];
}

@ObjectType()
export class SupportMember {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberNick: string;

	@Field(() => MemberType)
	memberType: MemberType;
}

@ObjectType()
export class SupportRequest {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => String)
	subject: string;

	@Field(() => String)
	content: string;

	@Field(() => SupportRequestStatus)
	status: SupportRequestStatus;

	@Field(() => String, { nullable: true })
	reply?: string | null;

	@Field(() => String, { nullable: true })
	adminId?: ObjectId | null;

	@Field(() => Date, { nullable: true })
	repliedAt?: Date | null;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => SupportMember, { nullable: true })
	memberData?: SupportMember | null;
}

@ObjectType()
export class SupportRequests {
	@Field(() => [SupportRequest])
	list: SupportRequest[];

	@Field(() => [TotalCounter])
	metaCounter: TotalCounter[];
}
