import { SetMetadata } from '@nestjs/common';

export const Roles = (isAdmin: boolean) => SetMetadata('isAdmin', isAdmin);
