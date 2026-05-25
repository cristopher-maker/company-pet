import { Component } from '@angular/core';
import { UiService } from '../../core/services/ui.service';

export type ResourceCategory =
  | 'Opciones de cuidado'
  | 'Financiación'
  | 'Checklist'
  | 'Guías prácticas';

export type ResourceItem = {
  id: string;
  title: string;
  category: ResourceCategory;
  summary: string;
  isPriority?: boolean;
};

const CATEGORY_KEY: Record<ResourceCategory, string> = {
  'Opciones de cuidado': 'care',
  'Financiación': 'finance',
  'Checklist': 'check',
  'Guías prácticas': 'guide',
};

const CATEGORY_ICON: Record<ResourceCategory, string> = {
  'Opciones de cuidado': `
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>`,
  'Financiación': `
    <rect x="1" y="4" width="22" height="16" rx="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>`,
  'Checklist': `
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
  'Guías prácticas': `
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
};

@Component({
  selector: 'app-resources',
  templateUrl: './resources.page.html',
  styleUrls: ['./resources.page.scss'],
})
export class ResourcesPage {
  public selectedCategory: 'Todos' | ResourceCategory = 'Todos';

  public readonly categories: readonly ResourceCategory[] = [
    'Opciones de cuidado',
    'Financiación',
    'Checklist',
    'Guías prácticas',
  ] as const;

  public readonly resources: ResourceItem[] = [
    {
      id: 'r1',
      title: 'Cómo elegir entre hotel para mascotas vs. cuidado a domicilio',
      category: 'Opciones de cuidado',
      summary: 'Factores clave: autonomía, red de apoyo, presupuesto y tiempos.',
    },
    {
      id: 'r2',
      title: 'Guía rápida de financiación (subsidios, seguros y copagos)',
      category: 'Financiación',
      summary: 'Mapa de alternativas y documentos típicos para postular.',
      isPriority: true,
    },
    {
      id: 'r3',
      title: 'Checklist para la primera evaluación de necesidades',
      category: 'Checklist',
      summary: 'Preguntas y señales de alerta para priorizar apoyos.',
    },
    {
      id: 'r4',
      title: 'Comunicación mascota: acuerdos y límites',
      category: 'Guías prácticas',
      summary: 'Cómo repartir tareas y mantener conversaciones difíciles.',
    },
  ];

  constructor(public readonly ui: UiService) {}

  public get filteredResources(): ResourceItem[] {
    if (this.selectedCategory === 'Todos') return this.resources;
    return this.resources.filter((r) => r.category === this.selectedCategory);
  }

  public setCategory(category: 'Todos' | ResourceCategory): void {
    this.selectedCategory = category;
  }

  public categoryKey(category: ResourceCategory): string {
    return CATEGORY_KEY[category] ?? 'guide';
  }

  public categoryIconPath(category: ResourceCategory): string {
    return CATEGORY_ICON[category] ?? '';
  }

  public trackById(_: number, r: ResourceItem): string {
    return r.id;
  }

  public trackByCat(_: number, c: ResourceCategory): string {
    return c;
  }

  public open(resource: ResourceItem): void {
    // TODO: navegar a detalle / abrir link externo
    alert(`Abrir (demo): ${resource.title}`);
  }
}