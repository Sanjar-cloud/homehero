import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import MemberSchema from '../../schemas/Member.model';
import NoticeSchema from '../../schemas/Notice.model';
import SupportRequestSchema from '../../schemas/SupportRequest.model';
import { SupportResolver } from './support.resolver';
import { SupportService } from './support.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Notice', schema: NoticeSchema },
			{ name: 'SupportRequest', schema: SupportRequestSchema },
		]),
	],
	providers: [SupportResolver, SupportService],
})
export class SupportModule {}
