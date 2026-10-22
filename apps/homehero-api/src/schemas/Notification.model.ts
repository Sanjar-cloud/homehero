import { Schema } from 'mongoose';
import { NotificationGroup, NotificationStatus, NotificationType } from '../libs/enums/notification.enum';

const NotificationSchema = new Schema(
	{
		notificationType: {
			type: String,
			enum: NotificationType,
			required: true,
		},

		notificationStatus: {
			type: String,
			enum: NotificationStatus,
			default: NotificationStatus.WAIT,
		},

		notificationGroup: {
			type: String,
			enum: NotificationGroup,
			required: true,
		},

		notificationTitle: {
			type: String,
			required: true,
		},

		notificationDesc: {
			type: String,
		},

		authorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

		receiverId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

		serviceId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
		},

		eventKey: { type: String },
		receiptOnly: { type: Boolean, default: false },
		conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
		messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
		supportRequestId: { type: Schema.Types.ObjectId, ref: 'SupportRequest' },
		authorNick: { type: String },
		serviceStatus: { type: String, enum: ['ACTIVE', 'PAUSED', 'DELETE'] },

		articleId: {
			type: Schema.Types.ObjectId,
			ref: 'BoardArticle',
		},
	},
	{ timestamps: true, collection: 'notifications' },
);

// Legacy notifications have no eventKey and are excluded from the unique index.
NotificationSchema.index({ eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } });
NotificationSchema.index({ receiverId: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ receiverId: 1, notificationStatus: 1 });
NotificationSchema.index({ receiverId: 1, conversationId: 1, messageId: 1 });

export default NotificationSchema;
