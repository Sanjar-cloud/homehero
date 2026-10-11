import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize, ArrayMinSize, IsArray, IsDate, IsDefined, IsEnum, IsIn, IsInt,
	IsMongoId, IsNotEmpty, IsOptional, IsString, Length, Max, Min, Validate,
	ValidateNested, ValidatorConstraint,
} from 'class-validator';
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
import { ServiceCategory, ServiceLocation, ServiceStatus } from '../../enums/service.enum';
import type { ObjectId } from 'mongoose';
import { availableServiceSorts } from '../../config';
import { Direction } from '../../enums/common.enum';

@InputType()
export class ServiceInput {
	@IsEnum(ServiceCategory)
	@Field(() => ServiceCategory)
	serviceCategory: ServiceCategory;

	@IsEnum(ServiceLocation)
	@Field(() => ServiceLocation)
	serviceLocation: ServiceLocation;

	@IsString()
	@Length(3, 100)
	@Field(() => String)
	serviceTitle: string;

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

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	@Field(() => [String])
	serviceImages: string[];

	// Assigned by the resolver, never exposed as client input.
	memberId?: ObjectId;
}

@ValidatorConstraint({ name: 'orderedRange', async: false })
class OrderedRange implements ValidatorConstraintInterface {
	validate(end: unknown, args: ValidationArguments): boolean {
		const start = (args.object as { start: unknown }).start;
		if (start instanceof Date && end instanceof Date) return start.getTime() <= end.getTime();
		return typeof start === 'number' && typeof end === 'number' && start <= end;
	}
	defaultMessage(): string { return 'Range end must be greater than or equal to start'; }
}

@InputType()
export class PricesRange {
	@IsInt()
	@Min(0)
	@Max(2147483647)
	@Field(() => Int)
	start: number;

	@IsInt()
	@Min(0)
	@Max(2147483647)
	@Validate(OrderedRange)
	@Field(() => Int)
	end: number;
}

@InputType()
export class PeriodsRange {
	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	start: Date;

	@Type(() => Date)
	@IsDate()
	@Validate(OrderedRange)
	@Field(() => Date)
	end: Date;
}

@InputType()
export class ServiceSearch {
	@IsOptional()
	@IsMongoId()
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceLocation, { each: true })
	@Field(() => [ServiceLocation], { nullable: true })
	locationList?: ServiceLocation[];

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceCategory, { each: true })
	@Field(() => [ServiceCategory], { nullable: true })
	categoryList?: ServiceCategory[];

	@IsOptional()
	@ValidateNested()
	@Type(() => PricesRange)
	@Field(() => PricesRange, { nullable: true })
	pricesRange?: PricesRange;

	@IsOptional()
	@ValidateNested()
	@Type(() => PeriodsRange)
	@Field(() => PeriodsRange, { nullable: true })
	periodsRange?: PeriodsRange;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class OrdinaryInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int)
	limit: number;
}

@InputType({ isAbstract: true })
class ServiceInquiry extends OrdinaryInquiry {
	@IsOptional()
	@IsIn(availableServiceSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;
}

@InputType()
export class ServicesInquiry extends ServiceInquiry {
	@IsDefined()
	@ValidateNested()
	@Type(() => ServiceSearch)
	@Field(() => ServiceSearch)
	search: ServiceSearch;
}

@InputType()
export class AgentServiceSearch {
	@IsOptional()
	@IsEnum(ServiceStatus)
	@Field(() => ServiceStatus, { nullable: true })
	serviceStatus?: ServiceStatus;
}

@InputType()
export class AgentServicesInquiry extends ServiceInquiry {
	@IsDefined()
	@ValidateNested()
	@Type(() => AgentServiceSearch)
	@Field(() => AgentServiceSearch)
	search: AgentServiceSearch;
}

@InputType()
export class AdminServiceSearch extends AgentServiceSearch {
	@IsOptional()
	@IsArray()
	@IsEnum(ServiceLocation, { each: true })
	@Field(() => [ServiceLocation], { nullable: true })
	serviceLocationList?: ServiceLocation[];
}

@InputType()
export class AllServicesInquiry extends ServiceInquiry {
	@IsDefined()
	@ValidateNested()
	@Type(() => AdminServiceSearch)
	@Field(() => AdminServiceSearch)
	search: AdminServiceSearch;
}
