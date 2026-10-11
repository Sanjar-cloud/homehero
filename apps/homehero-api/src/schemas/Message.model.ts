import { Schema } from 'mongoose';

const ServiceContextSchema = new Schema({
	serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
	serviceTitle: { type: String, required: true },
}, { _id: false });

const MessageSchema = new Schema({
	conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, immutable: true },
	senderId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, immutable: true },
	text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000, immutable: true },
	serviceContext: { type: ServiceContextSchema, default: null, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'messages' });

MessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
export default MessageSchema;
