import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ReviewSchema from '../../schemas/Review.model';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import { ReviewResolver } from './review.resolver';
import { ReviewService } from './review.service';

@Module({
	imports: [AuthModule, MongooseModule.forFeature([
		{ name: 'Review', schema: ReviewSchema },
		{ name: 'Member', schema: MemberSchema },
	])],
	providers: [ReviewResolver, ReviewService],
})
export class ReviewModule {}
