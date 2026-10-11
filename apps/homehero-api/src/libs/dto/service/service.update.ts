import { Field, InputType, Int } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { ServiceCategory, ServiceLocation, ServiceStatus } from '../../enums/service.enum';
import type { ObjectId } from 'mongoose';

@InputType()
export class ServiceUpdate {
	@IsMongoId()
	@Field(() => String)
	_id: ObjectId;

	@ValidateIf((_, value) => value !== undefined)
	@IsEnum(ServiceCategory)
	@Field(() => ServiceCategory, { nullable: true })
	serviceCategory?: ServiceCategory;

	@ValidateIf((_, value) => value !== undefined)
	@IsEnum(ServiceStatus)
	@Field(() => ServiceStatus, { nullable: true })
	serviceStatus?: ServiceStatus;

	@ValidateIf((_, value) => value !== undefined)
	@IsEnum(ServiceLocation)
	@Field(() => ServiceLocation, { nullable: true })
	serviceLocation?: ServiceLocation;

	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	serviceTitle?: string;

	@IsOptional()
	@IsString()
	@Length(5, 500)
	@Field(() => String, { nullable: true })
	serviceDesc?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(2147483647)
	@Field(() => Int, { nullable: true })
	servicePrice?: number | null;

	@ValidateIf((_, value) => value !== undefined)
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	@Field(() => [String], { nullable: true })
	serviceImages?: string[];
}
