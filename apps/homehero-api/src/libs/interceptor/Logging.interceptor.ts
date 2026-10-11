import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext, GqlContextType } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger('GraphQL');

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		if (context.getType<GqlContextType>() !== 'graphql') return next.handle();
		const startedAt = Date.now();
		const info = GqlExecutionContext.create(context).getInfo();
		const operation = info.operation.operation;
		const field = info.fieldName;
		// Never log query text, variables, headers, response bodies or error messages.
		return next.handle().pipe(tap({
			next: () => this.logger.log(`${operation} ${field} ${Date.now() - startedAt}ms`),
			error: () => this.logger.warn(`${operation} ${field} ${Date.now() - startedAt}ms REQUEST_FAILED`),
		}));
	}
}
