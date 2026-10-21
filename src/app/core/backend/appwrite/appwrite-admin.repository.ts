import { Injectable } from '@angular/core';
import { AdminRepository } from '../../repositories/admin.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService } from './appwrite-client';

@Injectable()
export class AppwriteAdminRepository extends AdminRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  setRole(userId: string, role: string): Promise<RepositoryResult<null>> {
    return this.call('setRole', { userId, role });
  }

  setPremium(userId: string, until: string | null): Promise<RepositoryResult<null>> {
    return this.call('setPremium', { userId, until });
  }

  setCanViewProfiles(userId: string, value: boolean | null): Promise<RepositoryResult<null>> {
    return this.call('setCanViewProfiles', { userId, value });
  }

  private async call(action: string, input: Record<string, unknown>) {
    const { error } = await this.appwrite.run('admin', action, input);
    return { data: null, error };
  }
}
