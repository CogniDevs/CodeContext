import { Component, inject, OnInit } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { TreePanelComponent } from './components/tree-panel/tree-panel.component';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { FooterComponent } from './components/footer/footer.component';
import { WasmService } from './core/services/wasm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    TreePanelComponent,
    ControlPanelComponent,
    FooterComponent
  ],
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
