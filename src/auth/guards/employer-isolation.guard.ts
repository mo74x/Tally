/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class EmployerIsolationGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isValidToken = await super.canActivate(context);
    if (!isValidToken) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const routeEmployerId = request.params.id;

    if (routeEmployerId && user.employerId !== routeEmployerId) {
      throw new ForbiddenException(
        'You do not have permission to access data for this employer.',
      );
    }

    //Enforce Role-Based Access
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Admin access required for employer operations.',
      );
    }

    return true;
  }
}
