import { HttpException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Notifications } from '../../libs/dto/notification/notification';
import { NotificationsInquiry, ReadMessageNotificationsInput } from '../../libs/dto/notification/notification.input';
import { NotificationGuard } from './notification.guard';
import { NotificationService } from './notification.service';

@Resolver()
@UseGuards(NotificationGuard)
export class NotificationResolver {
	constructor(private readonly notifications: NotificationService) {}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof HttpException && error.getStatus() < 500) throw error;
			throw new InternalServerErrorException('Notification operation failed');
		}
	}

	@Query(() => Notifications)
	getNotifications(@Context() context: any, @Args('input') input: NotificationsInquiry) {
		return this.execute(() => this.notifications.getNotifications(context.req.notificationMemberId, input));
	}

	@Mutation(() => Boolean)
	markNotificationRead(@Context() context: any, @Args('notificationId') notificationId: string) {
		return this.execute(() =>
			this.notifications.markNotificationRead(context.req.notificationMemberId, notificationId),
		);
	}

	@Mutation(() => Boolean)
	markAllNotificationsRead(@Context() context: any, @Args('before', { type: () => Date }) before: Date) {
		return this.execute(() => this.notifications.markAllNotificationsRead(context.req.notificationMemberId, before));
	}

	@Mutation(() => Boolean)
	markMessageNotificationsRead(@Context() context: any, @Args('input') input: ReadMessageNotificationsInput) {
		return this.execute(() => this.notifications.markMessageNotificationsRead(context.req.notificationMemberId, input));
	}
}
