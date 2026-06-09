import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';

export type ResourceCategory = 'Opciones de cuidado' | 'Financiación' | 'Guías prácticas' | 'Checklist';

export type ResourceItem = {
  id: string;
  title: string;
  category: ResourceCategory;
  summary: string;
  body_markdown?: string;
  external_url?: string;
  icon: string;
  is_featured?: boolean;
};

const CATEGORY_KEY: Record<ResourceCategory, string> = {
  'Opciones de cuidado': 'care',
  'Financiación': 'finance',
  'Guías prácticas': 'guide',
  'Checklist': 'check',
};

@Component({
  selector: 'app-resources',
  templateUrl: './resources.page.html',
  styleUrls: ['./resources.page.scss'],
})
export class ResourcesPage implements OnInit {
  public selectedCategory: 'Todos' | ResourceCategory = 'Todos';
  public selectedResource: ResourceItem | null = null;
  public loading = false;
  public resources: ResourceItem[] = [];

  public readonly categories: readonly ResourceCategory[] = [
    'Opciones de cuidado',
    'Financiación',
    'Guías prácticas',
    'Checklist',
  ] as const;

  constructor(private readonly supabase: SupabaseService) {}

  public async ngOnInit(): Promise<void> {
    await this.loadResources();
  }

  public async loadResources(): Promise<void> {
    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('resources')
        .select('id, title, category, summary, body_markdown, external_url, is_featured')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;

      this.resources = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category as ResourceCategory,
        summary: r.summary || '',
        body_markdown: r.body_markdown || '',
        external_url: r.external_url || '',
        is_featured: r.is_featured,
        icon: this.getIconForCategory(r.category),
      }));
    } catch (err) {
      console.error('Error loading resources:', err);
    } finally {
      this.loading = false;
    }
  }

  private getIconForCategory(category: string): string {
    switch (category) {
      case 'Opciones de cuidado':
        return 'pets';
      case 'Financiación':
        return 'payments';
      case 'Guías prácticas':
        return 'school';
      case 'Checklist':
        return 'task_alt';
      default:
        return 'library_books';
    }
  }

  public getFormattedBody(body: string | undefined): string {
    if (!body) return '';

    // Escapar caracteres básicos para evitar inyección XSS simple
    let html = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Reemplazar negrita: **texto** -> <strong>texto</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Reemplazar listas con viñetas: - elemento -> <li>elemento</li>
    const lines = html.split('\n');
    let inList = false;
    const formattedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        let prefix = '';
        if (!inList) {
          prefix = '<ul style="margin: 8px 0 8px 20px; padding-left: 0; list-style-type: disc;">';
          inList = true;
        }
        return `${prefix}<li style="margin-bottom: 6px;">${content}</li>`;
      } else {
        let suffix = '';
        if (inList) {
          suffix = '</ul>';
          inList = false;
        }
        return `${suffix}${line}`;
      }
    });

    if (inList) {
      formattedLines.push('</ul>');
    }

    // Unir líneas y convertir saltos de línea dobles en párrafos
    let finalHtml = formattedLines.join('\n');
    finalHtml = finalHtml
      .split(/\n\n+/)
      .map((para) => {
        const trimmed = para.trim();
        if (
          trimmed.startsWith('<ul') ||
          trimmed.startsWith('<li') ||
          trimmed.endsWith('</ul>')
        ) {
          return para;
        }
        return `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');

    return finalHtml;
  }

  public get filteredResources(): ResourceItem[] {
    if (this.selectedCategory === 'Todos') return this.resources;
    return this.resources.filter((resource) => resource.category === this.selectedCategory);
  }

  public setCategory(category: 'Todos' | ResourceCategory): void {
    this.selectedCategory = category;
  }

  public categoryKey(category: ResourceCategory): string {
    return CATEGORY_KEY[category] ?? 'guide';
  }

  public trackById(_: number, resource: ResourceItem): string {
    return resource.id;
  }

  public trackByCat(_: number, category: ResourceCategory): string {
    return category;
  }

  public open(resource: ResourceItem): void {
    this.selectedResource = resource;
  }

  public isExternalUrlVideo(url: string | undefined): boolean {
    if (!url) return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.mp4') || 
           cleanUrl.endsWith('.webm') || 
           cleanUrl.endsWith('.ogg') || 
           cleanUrl.endsWith('.mov');
  }

  public isExternalUrlPdf(url: string | undefined): boolean {
    if (!url) return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.pdf');
  }
}
