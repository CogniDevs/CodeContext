import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  readonly stateService = inject(StateService);
  readonly copyStatus = signal<string>('Скопировать в буфер');

  async copyToClipboard(): Promise<void> {
    const payload = this.stateService.generatedPayload();
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      this.copyStatus.set('Скопировано! ✓');
      setTimeout(() => this.copyStatus.set('Скопировать в буфер'), 2000);
    } catch {
      alert('Не удалось скопировать в буфер обмена.');
    }
  }

  downloadTxt(): void {
    const payload = this.stateService.generatedPayload();
    if (!payload) return;

    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code_context.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}
