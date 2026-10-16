import mongoose, { Schema } from 'mongoose';
import { NoticeCategory, NoticeStatus } from '../libs/enums/notice.enum';

const TranslationSchema = new Schema(
	{
		title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
		content: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
	},
	{ _id: false },
);

const TranslationsSchema = new Schema(
	{ kr: { type: TranslationSchema, default: null }, ru: { type: TranslationSchema, default: null } },
	{ _id: false },
);

const NoticeSchema = new Schema(
	{
		noticeCategory: {
			type: String,
			enum: NoticeCategory,
			required: true,
		},

		noticeStatus: {
			type: String,
			enum: NoticeStatus,
			default: NoticeStatus.ACTIVE,
		},

		noticeTitle: {
			type: String,
			required: true,
		},

		noticeContent: {
			type: String,
			required: true,
		},
		
		translations: { type: TranslationsSchema, default: null },

		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},
	},
	{ timestamps: true, collection: 'notices' },
);

export default NoticeSchema;
