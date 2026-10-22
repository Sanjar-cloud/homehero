import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { Services, Service } from '../../libs/dto/service/service';
import {
	AgentServicesInquiry,
	AllServicesInquiry,
	OrdinaryInquiry,
	ServicesInquiry,
	ServiceInput,
} from '../../libs/dto/service/service.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import type { ObjectId } from 'mongoose';
import { WithoutGuard } from '../auth/guards/without.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { ServiceUpdate } from '../../libs/dto/service/service.update';
import { AuthGuard } from '../auth/guards/auth.guard';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}

	private parseServiceId(input: unknown): ObjectId {
		if (typeof input !== 'string' || !isMongoId(input)) throw new BadRequestException('Invalid service ID');
		return shapeIntoMongoObjectId(input);
	}

	@Roles(MemberType.AGENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async createService(
		@Args('input') input: ServiceInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: createService');
		input.memberId = memberId;
		return await this.serviceService.createService(input);
	}

	@UseGuards(WithoutGuard)
	@Query((returns) => Service)
	public async getService(
		@Args('serviceId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Query: getService');
		const serviceId = this.parseServiceId(input);
		return await this.serviceService.getService(memberId, serviceId);
	}

	@Roles(MemberType.AGENT)
	@UseGuards(RolesGuard)
	@Mutation((returns) => Service)
	public async updateService(
		@Args('input') input: ServiceUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: updateService');
		input._id = this.parseServiceId(input._id);
		return await this.serviceService.updateService(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query((returns) => Services)
	public async getServices(
		@Args('input') input: ServicesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getServices');
		return await this.serviceService.getServices(memberId, input);
	}

	//getFavorite API
	@UseGuards(AuthGuard)
	@Query((returns) => Services)
	public async getFavorites(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getFavorites');
		return await this.serviceService.getFavorites(memberId, input);
	}

	//getVisited API
	@UseGuards(AuthGuard)
	@Query((returns) => Services)
	public async getVisited(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getVisited');
		return await this.serviceService.getVisited(memberId, input);
	}

	@Roles(MemberType.AGENT)
	@UseGuards(RolesGuard)
	@Query((returns) => Services)
	public async getAgentServices(
		@Args('input') input: AgentServicesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getAgentServices');
		return await this.serviceService.getAgentServices(memberId, input);
	}

	//like service

	@UseGuards(AuthGuard)
	@Mutation(() => Service)
	public async likeTargetService(
		@Args('serviceId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: likeTargetService');
		const likeRefId = this.parseServiceId(input);
		return await this.serviceService.likeTargetService(memberId, likeRefId);
	}

	/** ADMIN **/

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query((returns) => Services)
	public async getAllServicesByAdmin(
		@Args('input') input: AllServicesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getAllServicesByAdmin');
		return await this.serviceService.getAllServicesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation((returns) => Service)
	public async updateServiceByAdmin(@Args('input') input: ServiceUpdate, @AuthMember('_id') memberId: ObjectId): Promise<Service> {
		console.log('Mutation: updateServiceByAdmin');
		input._id = this.parseServiceId(input._id);
		return await this.serviceService.updateServiceByAdmin(input, memberId);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation((returns) => Service)
	public async removeServiceByAdmin(@Args('serviceId') input: string): Promise<Service> {
		console.log('Mutation: removeServiceByAdmin');
		const serviceId = this.parseServiceId(input);
		return await this.serviceService.removeServiceByAdmin(serviceId);
	}
}
