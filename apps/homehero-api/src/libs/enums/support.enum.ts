import { registerEnumType } from '@nestjs/graphql';

export enum SupportRequestStatus {
	OPEN = 'OPEN',
	ANSWERED = 'ANSWERED',
}

registerEnumType(SupportRequestStatus, { name: 'SupportRequestStatus' });
