import { HttpException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from 'mongoose';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { SupportNotice, SupportNotices, SupportRequest, SupportRequests } from '../../libs/dto/support/support';
import {
	AdminSupportNoticesInquiry,
	CreateSupportNoticeInput,
	CreateSupportRequestInput,
	ReplySupportRequestInput,
	SupportNoticesInquiry,
	SupportRequestsInquiry,
	UpdateSupportNoticeInput,
} from '../../libs/dto/support/support.input';
import { SupportService } from './support.service';

@Resolver()
export class SupportResolver {
	constructor(private readonly supportService: SupportService) {}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof HttpException && error.getStatus() < 500) throw error;
			throw new InternalServerErrorException('Support operation failed');
		}
	}

	@Query(() => SupportNotices)
	public getSupportNotices(@Args('input') input: SupportNoticesInquiry): Promise<SupportNotices> {
		return this.execute(() => this.supportService.getSupportNotices(input));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => SupportNotices)
	public getSupportNoticesByAdmin(
		@Args('input') input: AdminSupportNoticesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportNotices> {
		return this.execute(() => this.supportService.getSupportNoticesByAdmin(memberId, input));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportNotice)
	public createSupportNotice(
		@Args('input') input: CreateSupportNoticeInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportNotice> {
		return this.execute(() => this.supportService.createSupportNotice(memberId, input));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportNotice)
	public updateSupportNotice(
		@Args('input') input: UpdateSupportNoticeInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportNotice> {
		return this.execute(() => this.supportService.updateSupportNotice(memberId, input));
	}

	@UseGuards(AuthGuard)
	@Mutation(() => SupportRequest)
	public createSupportRequest(
		@Args('input') input: CreateSupportRequestInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportRequest> {
		return this.execute(() => this.supportService.createSupportRequest(memberId, input));
	}

	@UseGuards(AuthGuard)
	@Query(() => SupportRequests)
	public getMySupportRequests(
		@Args('input') input: SupportRequestsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportRequests> {
		return this.execute(() => this.supportService.getMySupportRequests(memberId, input));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => SupportRequests)
	public getSupportRequestsByAdmin(
		@Args('input') input: SupportRequestsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportRequests> {
		return this.execute(() => this.supportService.getSupportRequestsByAdmin(memberId, input));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportRequest)
	public replySupportRequest(
		@Args('input') input: ReplySupportRequestInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<SupportRequest> {
		return this.execute(() => this.supportService.replySupportRequest(memberId, input));
	}
}
