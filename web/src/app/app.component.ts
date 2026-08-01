import { Component, inject, OnInit } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { WasmService } from './core/services/wasm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly title = 'CodeContext';
  private readonly wasmService = inject(WasmService);

  async ngOnInit(): Promise<void> {
    await this.wasmService.init();
  }
}
