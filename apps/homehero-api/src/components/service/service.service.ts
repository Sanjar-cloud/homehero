import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, PipelineStage } from 'mongoose';
import { Service, ServiceProvider, Services } from '../../libs/dto/service/service';
import { Member } from '../../libs/dto/member/member';
import { MemberService } from '../member/member.service';
import { AgentServicesInquiry, AllServicesInquiry, OrdinaryInquiry, ServicesInquiry, ServiceInput } from '../../libs/dto/service/service.input';
import { Direction, Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { ServiceStatus } from '../../libs/enums/service.enum';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { ViewService } from '../view/view.service';
import { ServiceUpdate } from '../../libs/dto/service/service.update';
import { lookupAuthMemberLiked, lookupServiceProvider, serviceProviderProjection, shapeIntoMongoObjectId } from '../../libs/config';
import { LikeService } from '../like/like.service';
import { LikeGroup } from '../../libs/enums/like.enum';

@Injectable()
export class ServiceService {
	constructor(
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		private memberService: MemberService,
		private viewService: ViewService,
		private likeService: LikeService,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

	private async getProvider(memberId: ObjectId, publicOnly = true): Promise<ServiceProvider> {
		const search: T = { _id: memberId };
		if (publicOnly) Object.assign(search, { memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE });
		const member = await this.memberModel
			.findOne(search)
			.select(serviceProviderProjection)
			.lean<ServiceProvider>()
			.exec();
		if (!member) throw new BadRequestException(Message.NO_DATA_FOUND);
		return member;
	}

	// Used by likes/comments without recording a view or exposing private account fields.
	public async assertServiceVisible(serviceId: ObjectId): Promise<Service> {
		const service = await this.serviceModel
			.findOne({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE })
			.lean<Service>()
			.exec();
		if (!service) throw new BadRequestException(Message.NO_DATA_FOUND);
		service.memberData = await this.getProvider(service.memberId);
		return service;
	}

	private editableFields(input: ServiceInput | ServiceUpdate): T {
		const fields: T = {};
		for (const key of ['serviceCategory', 'serviceLocation', 'serviceTitle', 'serviceDesc', 'servicePrice', 'serviceImages']) {
			if (input[key] !== undefined) fields[key] = input[key];
		}
		return fields;
	}

	public async createService(input: ServiceInput): Promise<Service> {
		if (!input.memberId) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
		await this.getProvider(input.memberId);
		try {
			const result = await this.serviceModel.create({ ...this.editableFields(input), memberId: input.memberId });
			await this.memberService.memberStatsEditor({ _id: result.memberId, targetKey: 'memberServices', modifier: 1 });
			return result;
		} catch (err) {
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getService(memberId: ObjectId | null, serviceId: ObjectId): Promise<Service> {
		const service = await this.assertServiceVisible(serviceId);
		if (memberId) {
			const view = await this.viewService.recordView({ memberId, viewRefId: serviceId, viewGroup: ViewGroup.SERVICE });
			if (view) {
				await this.serviceStatsEditor({ _id: serviceId, targetKey: 'serviceViews', modifier: 1 });
				service.serviceViews++;
			}
			service.meLiked = await this.likeService.checkLikeExistence({ memberId, likeRefId: serviceId, likeGroup: LikeGroup.SERVICE });
		}
		return service;
	}

	public async updateService(memberId: ObjectId, input: ServiceUpdate): Promise<Service> {
		await this.getProvider(memberId);
		return this.updateListing({ _id: input._id, memberId }, input);
	}

	private async updateListing(search: T, input: ServiceUpdate): Promise<Service> {
		const current = await this.serviceModel
			.findOne({ ...search, serviceStatus: { $ne: ServiceStatus.DELETE } })
			.lean()
			.exec();
		if (!current) throw new BadRequestException(Message.UPDATE_FAILED);
		const nextStatus = input.serviceStatus ?? current.serviceStatus;
		const fields = this.editableFields(input);
		if (input.serviceStatus !== undefined) fields.serviceStatus = nextStatus;
		if (nextStatus === ServiceStatus.DELETE) fields.deletedAt = new Date();
		const update: T = { $set: fields };
		if (input.servicePrice === null) {
			delete fields.servicePrice;
			update.$unset = { servicePrice: 1 };
		}
		// Compare the observed status so concurrent transitions cannot apply the same counter delta twice.
		const result = await this.serviceModel
			.findOneAndUpdate(
				{ ...search, serviceStatus: current.serviceStatus },
				update,
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new BadRequestException(Message.UPDATE_FAILED);
		const modifier = Number(nextStatus === ServiceStatus.ACTIVE) - Number(current.serviceStatus === ServiceStatus.ACTIVE);
		if (modifier) await this.memberService.memberStatsEditor({ _id: current.memberId, targetKey: 'memberServices', modifier });
		return result;
	}

	private async listServices(
		match: T,
		input: OrdinaryInquiry & { sort?: string; direction?: Direction },
		memberId: ObjectId | null,
		publicOnly: boolean,
	): Promise<Services> {
		if (input.sort === 'servicePrice' && !match.servicePrice) match.servicePrice = { $type: 'number' };
		const pipeline: PipelineStage[] = [
			{ $match: match },
			lookupServiceProvider('memberId', 'memberData', publicOnly),
			{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: !publicOnly } },
			{ $sort: { [input.sort ?? 'createdAt']: input.direction ?? Direction.DESC } },
			{
				$facet: {
					list: [
						{ $skip: (input.page - 1) * input.limit },
						{ $limit: input.limit },
						lookupAuthMemberLiked(memberId),
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		];
		const result = await this.serviceModel.aggregate<Services>(pipeline).exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getServices(memberId: ObjectId | null, input: ServicesInquiry): Promise<Services> {
		const match: T = { serviceStatus: ServiceStatus.ACTIVE };
		const { memberId: providerId, locationList, categoryList, pricesRange, periodsRange, text } = input.search;
		if (providerId) match.memberId = shapeIntoMongoObjectId(providerId);
		if (locationList?.length) match.serviceLocation = { $in: locationList };
		if (categoryList?.length) match.serviceCategory = { $in: categoryList };
		if (pricesRange) match.servicePrice = { $type: 'number', $gte: pricesRange.start, $lte: pricesRange.end };
		if (periodsRange) match.createdAt = { $gte: periodsRange.start, $lte: periodsRange.end };
		if (text) match.serviceTitle = { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
		return this.listServices(match, input, memberId, true);
	}

	public async getFavorites(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		return this.likeService.getFavoriteServices(memberId, input);
	}

	public async getVisited(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		return this.viewService.getVisitedServices(memberId, input);
	}

	public async getAgentServices(memberId: ObjectId, input: AgentServicesInquiry): Promise<Services> {
		await this.getProvider(memberId);
		if (input.search.serviceStatus === ServiceStatus.DELETE) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
		return this.listServices(
			{ memberId, serviceStatus: input.search.serviceStatus ?? { $in: [ServiceStatus.ACTIVE, ServiceStatus.PAUSED] } },
			input,
			memberId,
			false,
		);
	}

	public async likeTargetService(memberId: ObjectId, serviceId: ObjectId): Promise<Service> {
		const target = await this.assertServiceVisible(serviceId);
		const modifier = await this.likeService.toggleLike({ memberId, likeRefId: serviceId, likeGroup: LikeGroup.SERVICE });
		const result = await this.serviceStatsEditor({ _id: serviceId, targetKey: 'serviceLikes', modifier });
		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		result.memberData = target.memberData;
		return result;
	}

	public async getAllServicesByAdmin(input: AllServicesInquiry): Promise<Services> {
		const match: T = {};
		if (input.search.serviceStatus) match.serviceStatus = input.search.serviceStatus;
		if (input.search.serviceLocationList?.length) match.serviceLocation = { $in: input.search.serviceLocationList };
		return this.listServices(match, input, null, false);
	}

	public async updateServiceByAdmin(input: ServiceUpdate): Promise<Service> {
		return this.updateListing({ _id: input._id }, input);
	}

	public async removeServiceByAdmin(serviceId: ObjectId): Promise<Service> {
		const result = await this.serviceModel
			.findOneAndDelete({ _id: serviceId, serviceStatus: ServiceStatus.DELETE })
			.exec();
		if (!result) throw new BadRequestException(Message.REMOVE_FAILED);
		return result;
	}

	public async serviceStatsEditor(input: StatisticModifier): Promise<Service | null> {
		return this.serviceModel
			.findByIdAndUpdate(
				input._id,
				{ $inc: { [input.targetKey]: input.modifier } },
				{ new: true, runValidators: true },
			)
			.exec();
	}
}
