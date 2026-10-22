import { Field, InputType, Int } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsMongoId, Max, Min } from 'class-validator';

@InputType()
export class NotificationsInquiry {
	@IsInt() @Min(1) @Max(1000000) @Field(() => Int) page: number;
	@IsInt() @Min(1) @Max(50) @Field(() => Int) limit: number;
}

@InputType()
export class ReadMessageNotificationsInput {
	@IsMongoId() @Field(() => String) conversationId: string;
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@ArrayUnique()
	@IsMongoId({ each: true })
	@Field(() => [String])
	messageIds: string[];
}
