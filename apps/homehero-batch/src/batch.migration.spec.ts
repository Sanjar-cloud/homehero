import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: jest.fn(() => 'offline-image') }));

import { Types } from 'mongoose';
import { BatchService } from './batch.service';
import { BatchController } from './batch.controller';
import { BATCH_TOP_SERVICES, BATCH_TOP_AGENTS, BATCH_ROLLBACK } from './lib/config';
import { ServiceStatus } from 'apps/homehero-api/src/libs/enums/service.enum';
import { MemberStatus, MemberType } from 'apps/homehero-api/src/libs/enums/member.enum';

function query(value: unknown) { return { exec: jest.fn().mockResolvedValue(value) }; }
function models() {
	const serviceId = new Types.ObjectId(); const memberId = new Types.ObjectId();
	const services = {
		updateMany: jest.fn().mockReturnValue(query({})),
		find: jest.fn().mockReturnValue(query([{ _id: serviceId, serviceLikes: 3, serviceViews: 4 }])),
		findByIdAndUpdate: jest.fn().mockResolvedValue({}),
	};
	const members = {
		updateMany: jest.fn().mockReturnValue(query({})),
		find: jest.fn().mockReturnValue(query([{ _id: memberId, memberServices: 2, memberArticles: 3, memberLikes: 4, memberViews: 5 }])),
		findByIdAndUpdate: jest.fn().mockResolvedValue({}),
	};
	return { services, members, serviceId, memberId, batch: new BatchService(services as any, members as any) };
}

describe('Service batch migration (mocked models; scheduler is not started)', () => {
	it('resets ACTIVE services and ACTIVE AGENT ranks', async () => {
		const h = models(); await h.batch.batchRollback();
		expect(h.services.updateMany).toHaveBeenCalledWith({ serviceStatus: ServiceStatus.ACTIVE }, { serviceRank: 0 });
		expect(h.members.updateMany).toHaveBeenCalledWith({ memberStatus: MemberStatus.ACTIVE, memberType: MemberType.AGENT }, { memberRank: 0 });
	});
	it('preserves the service likes*2 + views ranking formula', async () => {
		const h = models(); await h.batch.batchTopServices();
		expect(h.services.find).toHaveBeenCalledWith({ serviceStatus: ServiceStatus.ACTIVE, serviceRank: 0 });
		expect(h.services.findByIdAndUpdate).toHaveBeenCalledWith(h.serviceId, { serviceRank: 10 });
	});
	it('uses memberServices while preserving article/like/view weights', async () => {
		const h = models(); await h.batch.batchTopAgents();
		expect(h.members.find).toHaveBeenCalledWith({ memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE, memberRank: 0 });
		expect(h.members.findByIdAndUpdate).toHaveBeenCalledWith(h.memberId, { memberRank: 32 });
	});
	it('preserves cron expressions with the service job name', () => {
		const metadata = (name: string) => Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', BatchController.prototype[name]);
		expect(metadata('batchRollback')).toMatchObject({ cronTime: '00 00 01 * * *', name: BATCH_ROLLBACK });
		expect(metadata('batchTopServices')).toMatchObject({ cronTime: '20 00 01 * * *', name: BATCH_TOP_SERVICES });
		expect(metadata('batchTopAgents')).toMatchObject({ cronTime: '40 00 01 * * *', name: BATCH_TOP_AGENTS });
	});
});
