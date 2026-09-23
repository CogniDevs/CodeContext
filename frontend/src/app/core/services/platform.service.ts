import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of, tap } from 'rxjs';

import { ServiceStatus } from '@models/context.models';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private readonly http = inject(HttpClient);

  readonly status = signal<ServiceStatus | null>(null);
  readonly isChecking = signal<boolean>(true);
  readonly isDesktop = signal<boolean>(false);

  readonly isGitAvailable = computed<boolean>(
    () => this.isDesktop() && (this.status()?.desktop_bridge ?? false),
  );
  readonly isWatcherAvailable = computed<boolean>(() => this.isDesktop());
  readonly isWasmOnly = computed<boolean>(() => !this.isDesktop());

  constructor() {
    this.checkPlatform();
  }

  async checkPlatform(): Promise<boolean> {
    this.isChecking.set(true);
    const result = await firstValueFrom(
      this.http.get<ServiceStatus>('/api/status').pipe(
        tap((res) => {
          this.status.set(res);
          this.isDesktop.set(true);
          this.isChecking.set(false);
        }),
        catchError(() => {
          this.status.set(null);
          this.isDesktop.set(false);
          this.isChecking.set(false);
          return of(null);
        }),
      ),
    );
    return result !== null;
  }
}
