import { Schema } from 'mongoose';

const ConversationSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, immutable: true },
	agentId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, immutable: true },
}, { timestamps: true, collection: 'conversations' });

ConversationSchema.index({ userId: 1, agentId: 1 }, { unique: true });
ConversationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
ConversationSchema.index({ agentId: 1, createdAt: -1, _id: -1 });
export default ConversationSchema;
