import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator that extracts the authenticated user
 * from the request object. Optionally accepts a data key to return
 * a specific property of the user.
 *
 * @example
 * // Get the entire user object
 * @CurrentUser() user: User
 *
 * // Get a specific property
 * @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
