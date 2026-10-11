import { registerEnumType } from '@nestjs/graphql';

export enum ServiceCategory {
	PLUMBING = 'PLUMBING',
	ELECTRICAL = 'ELECTRICAL',
	CLEANING = 'CLEANING',
	HVAC = 'HVAC',
	HANDYMAN = 'HANDYMAN',
	OTHER = 'OTHER',
}
registerEnumType(ServiceCategory, { name: 'ServiceCategory' });

export enum ServiceStatus {
	ACTIVE = 'ACTIVE',
	PAUSED = 'PAUSED',
	DELETE = 'DELETE',
}
registerEnumType(ServiceStatus, { name: 'ServiceStatus' });

export enum ServiceLocation {
	SEOUL = 'SEOUL',
	BUSAN = 'BUSAN',
	INCHEON = 'INCHEON',
	DAEGU = 'DAEGU',
	GYEONGJU = 'GYEONGJU',
	GWANGJU = 'GWANGJU',
	CHONJU = 'CHONJU',
	DAEJON = 'DAEJON',
	JEJU = 'JEJU',
}
registerEnumType(ServiceLocation, { name: 'ServiceLocation' });
