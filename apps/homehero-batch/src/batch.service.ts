import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Member } from 'apps/homehero-api/src/libs/dto/member/member';
import { Service } from 'apps/homehero-api/src/libs/dto/service/service';
import { MemberStatus, MemberType } from 'apps/homehero-api/src/libs/enums/member.enum';
import { ServiceStatus } from 'apps/homehero-api/src/libs/enums/service.enum';
import { Model } from 'mongoose';

@Injectable()
export class BatchService {
	constructor(
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

	public async batchRollback(): Promise<void> {
		await this.serviceModel
			.updateMany(
				{
					serviceStatus: ServiceStatus.ACTIVE,
				},
				{ serviceRank: 0 },
			)
			.exec();

		await this.memberModel
			.updateMany(
				{
					memberStatus: MemberStatus.ACTIVE,
					memberType: MemberType.AGENT,
				},
				{ memberRank: 0 },
			)
			.exec();
	}

	public async batchTopServices(): Promise<void> {
		const services: Service[] = await this.serviceModel
			.find({
				serviceStatus: ServiceStatus.ACTIVE,
				serviceRank: 0,
			})
			.exec();

		const promisedList = services.map(async (ele: Service) => {
			const { _id, serviceLikes, serviceViews } = ele;
			const rank = serviceLikes * 2 + serviceViews * 1;
			return await this.serviceModel.findByIdAndUpdate(_id, { serviceRank: rank });
		});
		await Promise.all(promisedList);
	}

	public async batchTopAgents(): Promise<void> {
		const agents: Member[] = await this.memberModel
			.find({
				memberType: MemberType.AGENT,
				memberStatus: MemberStatus.ACTIVE,
				memberRank: 0,
			})
			.exec();

		const promisedList = agents.map(async (ele: Member) => {
			const { _id, memberServices, memberLikes, memberArticles, memberViews } = ele;
			const rank = memberServices * 5 + memberArticles * 3 + memberLikes * 2 + memberViews * 1;
			return await this.memberModel.findByIdAndUpdate(_id, { memberRank: rank });
		});
		await Promise.all(promisedList);
	}

	public getHello(): string {
		return 'Welcome to HomeHero BATCH Server!';
	}
}
