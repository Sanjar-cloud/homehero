import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { NotificationStatus, NotificationType } from '../../enums/notification.enum';
import { ServiceStatus } from '../../enums/service.enum';

@ObjectType()
export class Notification {
	@Field(() => String) _id: Types.ObjectId;
	@Field(() => NotificationType) notificationType: NotificationType;
	@Field(() => NotificationStatus) notificationStatus: NotificationStatus;
	@Field(() => String) notificationTitle: string;
	@Field(() => String, { nullable: true }) authorNick?: string;
	@Field(() => String, { nullable: true }) conversationId?: Types.ObjectId;
	@Field(() => String, { nullable: true }) messageId?: Types.ObjectId;
	@Field(() => String, { nullable: true }) supportRequestId?: Types.ObjectId;
	@Field(() => String, { nullable: true }) serviceId?: Types.ObjectId;
	@Field(() => ServiceStatus, { nullable: true }) serviceStatus?: ServiceStatus;
	@Field(() => Date) createdAt: Date;
}

@ObjectType()
export class Notifications {
	@Field(() => [Notification]) list: Notification[];
	@Field(() => Int) total: number;
	@Field(() => Int) unreadCount: number;
	@Field(() => Date) readBefore: Date;
}
