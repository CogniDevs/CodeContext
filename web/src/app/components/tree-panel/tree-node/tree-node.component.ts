import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { FileNode } from '../../../core/services/file-system.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-node.component.html',
  styleUrl: './tree-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: FileNode;
  @Input() depth = 0;
  @Input() searchQuery = '';

  readonly stateService = inject(StateService);

  get isExpanded(): boolean {
    return this.stateService.isPathExpanded(this.node.rel_path);
  }

  toggleExpand(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.node.is_dir) {
      this.stateService.togglePathExpansion(this.node.rel_path);
    }
  }

  onRowClick(node: FileNode): void {
    if (node.is_dir) {
      this.toggleExpand();
    } else {
      this.stateService.setFocusedPath(node.rel_path);
    }
  }

  isFocused(node: FileNode): boolean {
    return !node.is_dir && this.stateService.focusedPath() === node.rel_path;
  }

  getSelectionState(node: FileNode): { checked: boolean; indeterminate: boolean } {
    const selectedSet = this.stateService.selectedPaths();
    if (!node.is_dir) {
      const isSel = selectedSet.has(node.rel_path);
      return { checked: isSel, indeterminate: false };
    }

    let total = 0;
    let selected = 0;

    const traverse = (n: FileNode) => {
      for (let i = 0; i < n.children.length; i++) {
        const child = n.children[i];
        if (!child.is_dir) {
          total++;
          if (selectedSet.has(child.rel_path)) {
            selected++;
          }
        } else {
          traverse(child);
        }
      }
    };

    traverse(node);

    if (total === 0) {
      return { checked: false, indeterminate: false };
    }
    if (selected === total) {
      return { checked: true, indeterminate: false };
    }
    if (selected > 0) {
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
      for (let i = 0; i < node.children.length; i++) {
        this.toggleNodeRecursive(node.children[i], check);
      }
    }
  }

  shouldShowNode(node: FileNode): boolean {
    if (!this.searchQuery) return true;
    const q = this.searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.is_dir) {
      for (let i = 0; i < node.children.length; i++) {
        if (this.shouldShowNode(node.children[i])) {
          return true;
        }
      }
    }
    return false;
  }

  formatSize(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}
