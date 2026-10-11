import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from 'mongoose';
import { ServiceCategory, ServiceLocation, ServiceStatus } from '../../enums/service.enum';
import { TotalCounter } from '../member/member';
import { MeLiked } from '../like/like';

@ObjectType()
export class ServiceProvider {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberNick: string;

	@Field(() => String)
	memberImage: string;

	@Field(() => String, { nullable: true })
	memberDesc?: string;

	@Field(() => Int)
	memberServices: number;
}

@ObjectType()
export class Service {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => ServiceCategory)
	serviceCategory: ServiceCategory;

	@Field(() => ServiceStatus)
	serviceStatus: ServiceStatus;

	@Field(() => ServiceLocation)
	serviceLocation: ServiceLocation;

	@Field(() => String)
	serviceTitle: string;

	@Field(() => String, { nullable: true })
	serviceDesc?: string;

	@Field(() => Int, { nullable: true })
	servicePrice?: number | null;

	@Field(() => [String])
	serviceImages: string[];

	@Field(() => Int)
	serviceViews: number;

	@Field(() => Int)
	serviceLikes: number;

	@Field(() => Int)
	serviceComments: number;

	@Field(() => Int)
	serviceRank: number;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => ServiceProvider, { nullable: true })
	memberData?: ServiceProvider;

	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];
}

@ObjectType()
export class Services {
	@Field(() => [Service])
	list: Service[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
