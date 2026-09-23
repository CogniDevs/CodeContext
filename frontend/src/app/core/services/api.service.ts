import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CompilePromptResponse,
  CustomRuleRequest,
  DependenciesRequest,
  DependenciesResponse,
  FileNode,
  GitDiffRequest,
  GitDiffResponse,
  GitStatusRequest,
  GitStatusResponse,
  PayloadRequest,
  PayloadResponse,
  PromptPreset,
  RuleItem,
  SaveFileRequest,
  SaveFileResponse,
  ScanOptions,
  ScanRequest,
  ServiceStatus,
  StandaloneTreeRequest,
  StandaloneTreeResponse,
  TokenCountRequest,
  TokenCountResponse,
  WatcherEvent,
} from '@models/context.models';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<ServiceStatus> {
    return this.http.get<ServiceStatus>('/api/status');
  }

  selectFolder(): Observable<{ success: boolean; path: string }> {
    return this.http.post<{ success: boolean; path: string }>(
      '/api/select-folder',
      {},
    );
  }

  getGitignoreRules(rootDir: string): Observable<{ rules: string[] }> {
    const params = new HttpParams().set('root_dir', rootDir);
    return this.http.get<{ rules: string[] }>('/api/gitignore', { params });
  }

  scanDirectory(
    rootDir: string,
    options?: ScanOptions | null,
  ): Observable<FileNode> {
    const payload: ScanRequest = { root_dir: rootDir, options };
    return this.http.post<FileNode>('/api/scan', payload);
  }

  buildPayload(req: PayloadRequest): Observable<PayloadResponse> {
    return this.http.post<PayloadResponse>('/api/payload', req);
  }

  generateStandaloneTree(
    req: StandaloneTreeRequest,
  ): Observable<StandaloneTreeResponse> {
    return this.http.post<StandaloneTreeResponse>(
      '/api/payload/standalone-tree',
      req,
    );
  }

  countTokens(text: string): Observable<TokenCountResponse> {
    const payload: TokenCountRequest = { text };
    return this.http.post<TokenCountResponse>('/api/payload/tokens', payload);
  }

  getGitStatus(rootDir: string): Observable<GitStatusResponse> {
    const payload: GitStatusRequest = { root_dir: rootDir };
    return this.http.post<GitStatusResponse>('/api/git/status', payload);
  }

  getGitDiff(
    rootDir: string,
    contextLines: number = 3,
  ): Observable<GitDiffResponse> {
    const payload: GitDiffRequest = {
      root_dir: rootDir,
      context_lines: contextLines,
    };
    return this.http.post<GitDiffResponse>('/api/git/diff', payload);
  }

  traceDependencies(
    req: DependenciesRequest,
  ): Observable<DependenciesResponse> {
    return this.http.post<DependenciesResponse>('/api/dependencies', req);
  }

  getSettings(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/settings');
  }

  saveSettings(
    settingsData: Record<string, unknown>,
  ): Observable<{ status: string; settings: Record<string, unknown> }> {
    return this.http.post<{
      status: string;
      settings: Record<string, unknown>;
    }>('/api/settings', settingsData);
  }

  getPrompts(): Observable<Record<string, PromptPreset>> {
    return this.http.get<Record<string, PromptPreset>>('/api/prompts');
  }

  updatePrompt(
    preset: PromptPreset,
  ): Observable<{ status: string; prompt: PromptPreset }> {
    return this.http.post<{ status: string; prompt: PromptPreset }>(
      '/api/prompts',
      preset,
    );
  }

  deletePrompt(key: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`/api/prompts/${key}`);
  }

  getRules(): Observable<Record<string, RuleItem[]>> {
    return this.http.get<Record<string, RuleItem[]>>('/api/rules');
  }

  addCustomRule(
    rule: CustomRuleRequest,
  ): Observable<{ status: string; rule: RuleItem }> {
    return this.http.post<{ status: string; rule: RuleItem }>(
      '/api/rules/custom',
      rule,
    );
  }

  compilePrompt(
    selectedRules: Record<string, string[]>,
  ): Observable<CompilePromptResponse> {
    return this.http.post<CompilePromptResponse>('/api/rules/compile', {
      selected_rules: selectedRules,
    });
  }

  saveFile(filePath: string, content: string): Observable<SaveFileResponse> {
    const payload: SaveFileRequest = { file_path: filePath, content };
    return this.http.post<SaveFileResponse>('/api/save-file', payload);
  }

  watchFileEvents(): Observable<WatcherEvent> {
    return new Observable<WatcherEvent>((subscriber) => {
      const eventSource = new EventSource('/api/watch/events');

      eventSource.addEventListener('file_change', (event: MessageEvent) => {
        try {
          const parsed: WatcherEvent = JSON.parse(event.data);
          subscriber.next(parsed);
        } catch (err) {
          subscriber.error(err);
        }
      });

      eventSource.onerror = (error) => {
        subscriber.error(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
