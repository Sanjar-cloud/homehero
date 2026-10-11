import { Schema } from 'mongoose';
import { ServiceCategory, ServiceLocation, ServiceStatus } from '../libs/enums/service.enum';

const ServiceSchema = new Schema(
	{
		serviceCategory: { type: String, enum: ServiceCategory, required: true },
		serviceStatus: { type: String, enum: ServiceStatus, required: true, default: ServiceStatus.ACTIVE },
		serviceLocation: { type: String, enum: ServiceLocation, required: true },
		serviceTitle: { type: String, required: true, minlength: 3, maxlength: 100 },
		serviceDesc: { type: String, minlength: 5, maxlength: 500 },
		servicePrice: {
			type: Number,
			min: 0,
			max: 2147483647,
			validate: { validator: (value: number | null) => value == null || Number.isInteger(value), message: 'Price must be integer KRW' },
		},
		serviceImages: {
			type: [String],
			required: true,
			validate: {
				validator: (images: string[]) => images.length >= 1 && images.length <= 10 && images.every((image) => image.trim().length > 0),
				message: 'Provide 1 to 10 image paths',
			},
		},
		serviceViews: { type: Number, default: 0 },
		serviceLikes: { type: Number, default: 0 },
		serviceComments: { type: Number, default: 0 },
		serviceRank: { type: Number, default: 0 },
		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
		deletedAt: { type: Date },
	},
	{ timestamps: true, collection: 'services' },
);

ServiceSchema.index({ serviceStatus: 1, serviceLocation: 1, serviceCategory: 1 });
ServiceSchema.index({ memberId: 1, serviceStatus: 1 });

export default ServiceSchema;
