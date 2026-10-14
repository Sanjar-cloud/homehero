import { Schema } from 'mongoose';

const ReviewSchema = new Schema(
	{
		authorId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		agentId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		text: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 2000,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'reviews' },
);

ReviewSchema.index({ agentId: 1, createdAt: -1, _id: -1 });

export default ReviewSchema;
