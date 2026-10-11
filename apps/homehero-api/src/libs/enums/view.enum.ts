import { registerEnumType } from '@nestjs/graphql';

export enum ViewGroup {
	MEMBER = 'MEMBER',
	ARTICLE = 'ARTICLE',
	SERVICE = 'SERVICE',
}
registerEnumType(ViewGroup, {
	name: 'ViewGroup',
});
