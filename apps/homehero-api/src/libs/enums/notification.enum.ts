import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
	MESSAGE = 'MESSAGE',
	SUPPORT_REPLY = 'SUPPORT_REPLY',
	SERVICE_STATUS = 'SERVICE_STATUS',
	LIKE = 'LIKE',
	COMMENT = 'COMMENT',
}
registerEnumType(NotificationType, {
	name: 'NotificationType',
});

export enum NotificationStatus {
	WAIT = 'WAIT',
	READ = 'READ',
}
registerEnumType(NotificationStatus, {
	name: 'NotificationStatus',
});

export enum NotificationGroup {
	MEMBER = 'MEMBER',
	ARTICLE = 'ARTICLE',
	SERVICE = 'SERVICE',
}
registerEnumType(NotificationGroup, {
	name: 'NotificationGroup',
});
