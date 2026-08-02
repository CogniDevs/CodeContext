import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { FileNode } from '../../../core/services/file-system.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-node.component.html',
  styleUrl: './tree-node.component.scss'
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: FileNode;
  @Input() depth = 0;
  @Input() searchQuery = '';
  @Input() isExpanded = true;

  readonly stateService = inject(StateService);

  onRowClick(node: FileNode): void {
    if (!node.is_dir) {
      this.stateService.setFocusedPath(node.rel_path);
    }
  }

  isFocused(node: FileNode): boolean {
    return !node.is_dir && this.stateService.focusedPath() === node.rel_path;
  }

  getSelectionState(node: FileNode): { checked: boolean; indeterminate: boolean } {
    if (!node.is_dir) {
      const isSel = this.stateService.selectedPaths().has(node.rel_path);
      return { checked: isSel, indeterminate: false };
    }
    const stats = this.getDescendantsStats(node);
    if (stats.total === 0) {
      return { checked: false, indeterminate: false };
    }
    if (stats.selected === stats.total) {
      return { checked: true, indeterminate: false };
    }
    if (stats.selected > 0) {
      return { checked: false, indeterminate: true };
    }
    return { checked: false, indeterminate: false };
  }

  onCheckboxChange(event: Event, node: FileNode): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleNodeRecursive(node, checked);
    this.stateService.generatePayload();
  }

  private toggleNodeRecursive(node: FileNode, check: boolean): void {
    if (!node.is_dir) {
      this.stateService.togglePathSelection(node.rel_path, check);
    } else {
      for (const child of node.children) {
        this.toggleNodeRecursive(child, check);
      }
    }
  }

  private getDescendantsStats(node: FileNode): { total: number; selected: number } {
    let total = 0;
    let selected = 0;
    for (const child of node.children) {
      if (!child.is_dir) {
        total++;
        if (this.stateService.selectedPaths().has(child.rel_path)) {
          selected++;
        }
      } else {
        const sub = this.getDescendantsStats(child);
        total += sub.total;
        selected += sub.selected;
      }
    }
    return { total, selected };
  }

  shouldShowNode(node: FileNode): boolean {
    if (!this.searchQuery) return true;
    const q = this.searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.is_dir) {
      return node.children.some(c => this.shouldShowNode(c));
    }
    return false;
  }

  formatSize(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}
