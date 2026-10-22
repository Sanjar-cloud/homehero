import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class NotificationGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = GqlExecutionContext.create(context).getContext().req;
		const header = req?.headers?.authorization;
		if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header))
			throw new UnauthorizedException('Authentication required');
		try {
			const member = await this.auth.verifyToken(header.split(' ')[1]);
			req.notificationMemberId = member._id;
			return true;
		} catch {
			throw new UnauthorizedException('Authentication required');
		}
	}
}
