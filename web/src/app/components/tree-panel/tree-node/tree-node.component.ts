import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { FileNode } from '../../../core/services/file-system.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, TreeNodeComponent],
  templateUrl: './tree-node.component.html',
  styleUrl: './tree-node.component.scss'
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: FileNode;
  @Input() depth = 0;
  @Input() searchQuery = '';

  readonly stateService = inject(StateService);
  isExpanded = true;

  isSelected(node: FileNode): boolean {
    if (node.is_dir) {
      return this.isDirSelected(node);
    }
    return this.stateService.selectedPaths().has(node.rel_path);
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

  private isDirSelected(node: FileNode): boolean {
    if (node.children.length === 0) return false;
    return node.children.some(c => this.isSelected(c));
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
