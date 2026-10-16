import { Schema } from 'mongoose';
import { SupportRequestStatus } from '../libs/enums/support.enum';

const SupportRequestSchema = new Schema(
	{
		memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
		subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
		content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
		status: { type: String, enum: SupportRequestStatus, default: SupportRequestStatus.OPEN },
		reply: { type: String, trim: true, minlength: 1, maxlength: 2000, default: null },
		adminId: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
		repliedAt: { type: Date, default: null },
	},
	{ timestamps: true, collection: 'supportRequests' },
);

SupportRequestSchema.index({ memberId: 1, createdAt: -1, _id: -1 });
SupportRequestSchema.index({ status: 1, createdAt: -1, _id: -1 });

export default SupportRequestSchema;
