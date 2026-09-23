import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FooterComponent {
  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);

  readonly copyStatus = signal<string>('Скопировать в буфер');

  readonly isExportDisabled = computed<boolean>(() => {
    return this.state.generatedPayload().length === 0;
  });

  readonly downloadFileName = computed<string>(() => {
    return this.state.transformOptions().xml_format
      ? 'code_context.xml'
      : 'code_context.txt';
  });

  protected async copyToClipboard(): Promise<void> {
    const payload = this.state.generatedPayload();
    if (!payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      this.copyStatus.set('Скопировано! ✓');
      setTimeout(() => this.copyStatus.set('Скопировать в буфер'), 2000);
    } catch {
      alert('Не удалось скопировать контекст в буфер обмена.');
    }
  }

  protected downloadContextFile(): void {
    const payload = this.state.generatedPayload();
    if (!payload) {
      return;
    }

    const mimeType = this.state.transformOptions().xml_format
      ? 'application/xml;charset=utf-8'
      : 'text/plain;charset=utf-8';

    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadFileName();
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
