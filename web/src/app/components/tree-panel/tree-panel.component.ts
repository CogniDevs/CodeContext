import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileSystemService } from '../../core/services/file-system.service';
import { StateService } from '../../core/services/state.service';
import { TreeNodeComponent } from './tree-node/tree-node.component';

@Component({
  selector: 'app-tree-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TreeNodeComponent],
  templateUrl: './tree-panel.component.html',
  styleUrl: './tree-panel.component.scss'
})
export class TreePanelComponent {
  readonly fileSystemService = inject(FileSystemService);
  readonly stateService = inject(StateService);

  searchQuery = '';

  selectAll(check: boolean): void {
    this.stateService.selectAllFiles(check);
    this.stateService.generatePayload();
  }

  setExpandAll(expand: boolean): void {
    if (expand) {
      this.stateService.expandAllFolders();
    } else {
      this.stateService.collapseAllFolders();
    }
  }

  async onTraceDependencies(): Promise<void> {
    const count = await this.stateService.traceDependenciesForFocusedFile();
    if (count === 0) {
      alert('Для выбранного файла не найдено локальных импортов.');
    }
  }
}
