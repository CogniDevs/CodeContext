import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  from,
  merge,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { FileNode } from '@models/context.models';
import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';

@Component({
  selector: 'app-paths-panel',
  templateUrl: './paths-panel.component.html',
  styleUrl: './paths-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class PathsPanelComponent {
  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  protected readonly fileSystem = inject(FileSystemService);
  private readonly api = inject(ApiService);

  protected readonly browseFolderTrigger$ = new Subject<void>();

  private readonly desktopFolderHandler$ = this.browseFolderTrigger$.pipe(
    exhaustMap(() => {
      if (!this.platform.isDesktop()) {
        return EMPTY;
      }
      return this.api.selectFolder().pipe(
        switchMap((res) => {
          if (!res.success || !res.path) {
            return EMPTY;
          }
          this.state.isGenerating.set(true);
          return this.api
            .scanDirectory(res.path, this.state.scanOptions())
            .pipe(
              tap((tree: FileNode) => {
                this.state.setRootNode(tree, res.path);
                this.state.selectAllFiles(true);
              }),
              switchMap(() => from(this.state.generatePayload())),
              tap(() => {
                this.state.isGenerating.set(false);
              }),
              catchError((err: unknown) => {
                this.state.isGenerating.set(false);
                const message = this.extractErrorMessage(err);
                this.state.appendLog(`Ошибка сканирования: ${message}`);
                return EMPTY;
              }),
            );
        }),
        catchError((err: unknown) => {
          const message = this.extractErrorMessage(err);
          this.state.appendLog(`Ошибка диалога: ${message}`);
          return EMPTY;
        }),
      );
    }),
  );

  private readonly webFolderHandler$ = this.browseFolderTrigger$.pipe(
    exhaustMap(() => {
      if (this.platform.isDesktop()) {
        return EMPTY;
      }
      return from(
        this.fileSystem.openDirectoryPicker(this.state.scanOptions()),
      ).pipe(
        tap(() => {
          this.state.selectAllFiles(true);
        }),
        switchMap(() => from(this.state.generatePayload())),
        catchError((err: unknown) => {
          const isAbort = err instanceof Error && err.name === 'AbortError';
          if (!isAbort) {
            const message = this.extractErrorMessage(err);
            this.state.appendLog(`Ошибка открытия директории: ${message}`);
          }
          return of(null);
        }),
      );
    }),
  );

  private readonly sideEffects$ = merge(
    this.desktopFolderHandler$,
    this.webFolderHandler$,
  );

  constructor() {
    this.sideEffects$.pipe(takeUntilDestroyed()).subscribe();
  }

  protected onProjectDirChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const path = input.value.trim();
    this.state.setRootPath(path);
  }

  protected onExportPathChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const path = input.value.trim();
    this.state.setExportPath(path);
  }

  protected browseProjectDir(): void {
    this.browseFolderTrigger$.next();
  }

  protected browseExportPath(): void {
    const currentPath = this.state.exportPath();
    const extension = this.state.transformOptions().xml_format
      ? '.xml'
      : '.txt';

    if (!currentPath && this.state.rootPath()) {
      this.state.setExportPath(
        `${this.state.rootPath().replace(/[\\/]$/, '')}/code_context${extension}`,
      );
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (err && typeof err === 'object') {
      if ('error' in err) {
        const httpErr = (err as { error: unknown }).error;
        if (typeof httpErr === 'string') {
          return httpErr;
        }
        if (httpErr && typeof httpErr === 'object' && 'detail' in httpErr) {
          return String((httpErr as { detail: unknown }).detail);
        }
        return JSON.stringify(httpErr);
      }
      if ('message' in err) {
        return String((err as { message: unknown }).message);
      }
    }
    return String(err);
  }
}
