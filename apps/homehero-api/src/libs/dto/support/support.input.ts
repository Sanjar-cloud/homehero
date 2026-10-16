import { Transform, Type } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { NoticeCategory, NoticeStatus } from '../../enums/notice.enum';
import { SupportRequestStatus } from '../../enums/support.enum';

@InputType()
export class SupportTranslationInput {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(3, 100)
	@Field(() => String)
	title: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 5000)
	@Field(() => String)
	content: string;
}

@InputType()
export class SupportTranslationsInput {
	@IsOptional()
	@ValidateNested()
	@Type(() => SupportTranslationInput)
	@Field(() => SupportTranslationInput, { nullable: true })
	kr?: SupportTranslationInput | null;

	@IsOptional()
	@ValidateNested()
	@Type(() => SupportTranslationInput)
	@Field(() => SupportTranslationInput, { nullable: true })
	ru?: SupportTranslationInput | null;
}

@InputType({ isAbstract: true })
export class SupportPagination {
	@IsInt()
	@Min(1)
	@Max(2147483647)
	@Field(() => Int)
	page: number;

	@IsInt()
	@Min(1)
	@Max(50)
	@Field(() => Int)
	limit: number;
}

@InputType()
export class SupportNoticesInquiry extends SupportPagination {
	@IsIn([NoticeCategory.FAQ, NoticeCategory.ANNOUNCEMENT])
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@IsOptional()
	@IsString()
	@Length(0, 100)
	@Field(() => String, { nullable: true })
	text?: string | null;
}

@InputType()
export class AdminSupportNoticesInquiry extends SupportNoticesInquiry {
	@IsOptional()
	@IsIn([NoticeStatus.HOLD, NoticeStatus.ACTIVE])
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus | null;
}

@InputType({ isAbstract: true })
export class SupportNoticeContentInput {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(3, 100)
	@Field(() => String)
	noticeTitle: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 5000)
	@Field(() => String)
	noticeContent: string;

	@IsIn([NoticeStatus.HOLD, NoticeStatus.ACTIVE])
	@Field(() => NoticeStatus, { defaultValue: NoticeStatus.HOLD })
	noticeStatus: NoticeStatus;

	@IsOptional()
	@ValidateNested()
	@Type(() => SupportTranslationsInput)
	@Field(() => SupportTranslationsInput, { nullable: true })
	translations?: SupportTranslationsInput | null;
}

@InputType()
export class CreateSupportNoticeInput extends SupportNoticeContentInput {
	@IsIn([NoticeCategory.FAQ, NoticeCategory.ANNOUNCEMENT])
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;
}

@InputType()
export class UpdateSupportNoticeInput extends SupportNoticeContentInput {
	@IsMongoId()
	@Field(() => String)
	_id: string;
}

@InputType()
export class CreateSupportRequestInput {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(3, 100)
	@Field(() => String)
	subject: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 2000)
	@Field(() => String)
	content: string;
}

@InputType()
export class SupportRequestsInquiry extends SupportPagination {
	@IsOptional()
	@IsIn([SupportRequestStatus.OPEN, SupportRequestStatus.ANSWERED])
	@Field(() => SupportRequestStatus, { nullable: true })
	status?: SupportRequestStatus | null;
}

@InputType()
export class ReplySupportRequestInput {
	@IsMongoId()
	@Field(() => String)
	_id: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@Length(1, 2000)
	@Field(() => String)
	reply: string;
}
