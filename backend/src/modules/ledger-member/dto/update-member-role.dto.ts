import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsIn(['OWNER', 'EDITOR', 'VIEWER'])
  role!: 'OWNER' | 'EDITOR' | 'VIEWER';
}
