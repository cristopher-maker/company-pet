import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-recursos',
  template: `
<div class="sec-hdr">
  <div>
    <div class="sec-title">Biblioteca de Recursos</div>
    <div class="sec-sub">{{ resources.length }} recursos educativos publicados para tutores y colaboradores</div>
  </div>
  <div class="sec-actions">
    <button *ngIf="!showForm" class="btn-primary" (click)="openNewForm()">
      <i class="ti ti-plus" style="font-size:13px"></i> Crear recurso
    </button>
    <button *ngIf="showForm" class="btn-secondary" (click)="cancel()">
      Cancelar
    </button>
  </div>
</div>

<!-- List of Resources -->
<div class="card" *ngIf="!showForm">
  <table>
    <thead>
      <tr>
        <th>Título</th>
        <th>Categoría</th>
        <th>Destacado</th>
        <th>Fecha Publicación</th>
        <th>Enlace Externo</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let r of resources">
        <td>
          <div style="font-weight:600; color:var(--text1)">{{ r.title }}</div>
          <div style="font-size:12px; color:var(--text2)">{{ r.summary | slice:0:80 }}{{ r.summary.length > 80 ? '...' : '' }}</div>
        </td>
        <td>
          <span class="badge" [ngClass]="getCategoryBadgeClass(r.category)">
            {{ r.category }}
          </span>
        </td>
        <td>
          <span class="chip" [ngClass]="r.is_featured ? 'chip-green' : 'chip-gray'">
            {{ r.is_featured ? 'Destacado' : 'Estándar' }}
          </span>
        </td>
        <td class="td-muted">{{ r.published_at ? (r.published_at | date:'dd MMM yyyy HH:mm') : 'Borrador' }}</td>
        <td>
          <a *ngIf="r.external_url" [href]="r.external_url" target="_blank" style="color:var(--blue); font-size:12px; text-decoration:underline">
            Ver enlace
          </a>
          <span *ngIf="!r.external_url" class="td-muted">—</span>
        </td>
        <td>
          <button class="card-action" style="font-size:11px; margin-right:6px" (click)="editResource(r)">Editar</button>
          <button class="card-action card-action--danger" style="font-size:11px" (click)="deleteResource(r.id, r.title)">Eliminar</button>
        </td>
      </tr>
      <tr *ngIf="resources.length === 0">
        <td colspan="6" style="text-align:center; color:var(--text3); padding:40px">
          No hay recursos creados. ¡Crea el primero usando el botón superior!
        </td>
      </tr>
    </tbody>
  </table>
</div>

<!-- Create / Edit Form -->
<div class="card" *ngIf="showForm" style="max-width:800px">
  <div class="card-hdr">
    <div class="card-title">{{ editId ? 'Editar' : 'Crear' }} Recurso Educativo</div>
  </div>
  
  <div class="form-row">
    <label class="form-label">Título del Recurso</label>
    <input class="form-input" [(ngModel)]="formData.title" placeholder="Ej. Guía para cuidar cachorros en invierno">
  </div>
  
  <div class="form-grid">
    <div class="form-row">
      <label class="form-label">Categoría</label>
      <select class="form-select" [(ngModel)]="formData.category">
        <option value="Opciones de cuidado">Opciones de cuidado</option>
        <option value="Financiación">Financiación</option>
        <option value="Guías prácticas">Guías prácticas</option>
        <option value="Checklist">Checklist</option>
      </select>
    </div>
    <div class="form-row" style="display:flex; align-items:center; height:100%; margin-top:24px">
      <label class="toggle" style="display:flex; align-items:center; gap:10px; cursor:pointer">
        <input type="checkbox" [(ngModel)]="formData.is_featured">
        <span class="toggle-slider-label" style="font-size:13px; font-weight:600; color:var(--text1)">Destacar en el Dashboard</span>
      </label>
    </div>
  </div>

  <div class="form-row">
    <label class="form-label">Resumen Breve (para tarjetas)</label>
    <textarea class="form-textarea" style="height:60px" [(ngModel)]="formData.summary" placeholder="Escribe un resumen corto del contenido de la guía..."></textarea>
  </div>

  <div class="form-row">
    <label class="form-label">Cuerpo de la Guía (Markdown soportado)</label>
    <textarea class="form-textarea" style="height:250px; font-family:monospace; font-size:13px" [(ngModel)]="formData.body_markdown" placeholder="Escribe la guía o tutorial. Soporta formato Markdown básico como **negritas** y listas con guiones (- item)."></textarea>
  </div>

  <div class="form-grid">
    <div class="form-row">
      <label class="form-label">Enlace Externo Opcional (URL)</label>
      <input class="form-input" [(ngModel)]="formData.external_url" placeholder="https://ejemplo.com/articulo">
    </div>
    <div class="form-row">
      <label class="form-label">Fecha y Hora de Publicación</label>
      <input class="form-input" type="datetime-local" [(ngModel)]="formData.published_at">
    </div>
  </div>

  <div class="form-row" style="margin-top: 15px;">
    <label class="form-label">O cargar archivo (PDF, Video o Imagen)</label>
    <div class="file-upload-zone" style="border: 2px dashed var(--border); padding: 20px; border-radius: 8px; background: var(--bg-hover); text-align: center; position: relative;">
      <input type="file" id="resourceFile" (change)="onFileSelected($event)" accept=".pdf,.mp4,.webm,.ogg,.mov,.png,.jpg,.jpeg,.webp" style="display: none;" [disabled]="uploading" />
      
      <div *ngIf="!uploading && !uploadSuccess && !isUploadedUrl(formData.external_url)" style="cursor: pointer;" (click)="triggerFileInput()">
        <i class="ti ti-upload" style="font-size: 28px; color: var(--text3); display: block; margin: 0 auto 8px;"></i>
        <div style="font-weight: 600; font-size: 13px; color: var(--text1);">Haga clic aquí para seleccionar y cargar un archivo</div>
        <div style="font-size: 11px; color: var(--text3); margin-top: 4px;">Máximo 100 MB (PDF, Videos, Imágenes)</div>
      </div>
      
      <div *ngIf="uploading" style="padding: 10px 0;">
        <i class="ti ti-loader spin" style="font-size: 24px; color: var(--green); display: block; margin: 0 auto 8px;"></i>
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--text1);">Cargando archivo... {{ uploadProgress }}%</div>
        <div style="width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; max-width: 300px; margin: 0 auto;">
          <div [style.width.%]="uploadProgress" style="height: 100%; background: var(--green); transition: width 0.15s ease-in-out;"></div>
        </div>
      </div>
      
      <div *ngIf="!uploading && (uploadSuccess || isUploadedUrl(formData.external_url))" style="padding: 10px 0;">
        <i class="ti ti-circle-check" style="font-size: 28px; color: var(--green); display: block; margin: 0 auto 8px;"></i>
        <div style="font-weight: 600; font-size: 13px; color: var(--green);">¡Archivo subido con éxito!</div>
        <div style="font-size: 11px; color: var(--text2); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90%; margin: 6px auto 10px;">
          {{ formData.external_url }}
        </div>
        <button type="button" class="btn-secondary" style="padding: 4px 12px; font-size: 11px; min-height: 28px;" (click)="removeUploadedFile()">
          Eliminar archivo
        </button>
      </div>
    </div>
  </div>

  <div style="margin-top:25px; display:flex; gap:10px">
    <button class="btn-primary" (click)="saveResource()" [disabled]="saving || uploading || !formData.title">
      {{ saving ? 'Guardando...' : 'Guardar recurso' }}
    </button>
    <button class="btn-secondary" (click)="cancel()">
      Cancelar
    </button>
  </div>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .toggle {
      display: inline-flex;
      align-items: center;
      user-select: none;
    }
    .toggle input {
      margin-right: 8px;
      width: 16px;
      height: 16px;
      accent-color: var(--green);
    }
    .card-action--danger {
      color: var(--red) !important;
    }
    .card-action--danger:hover {
      text-decoration: underline !important;
    }
    .spin {
      display: inline-block;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class RecursosComponent implements OnInit {
  resources: any[] = [];
  showForm = false;
  editId: string | null = null;
  saving = false;
  uploading = false;
  uploadProgress = 0;
  uploadSuccess = false;
  formData: any = this.emptyFormData();

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadResources();
  }

  async loadResources() {
    try {
      const { data, error } = await this.supabase.client
        .from('resources')
        .select('*')
        .order('published_at', { ascending: false });

      if (error) throw error;
      this.resources = data || [];
    } catch (err) {
      console.error('Error loading resources:', err);
    }
  }

  openNewForm() {
    this.editId = null;
    this.formData = this.emptyFormData();
    this.showForm = true;
    this.uploading = false;
    this.uploadProgress = 0;
    this.uploadSuccess = false;
  }

  editResource(r: any) {
    this.editId = r.id;
    this.uploading = false;
    this.uploadProgress = 0;
    this.uploadSuccess = false;
    
    // Format published_at datetime for datetime-local input
    let formattedDate = '';
    if (r.published_at) {
      const d = new Date(r.published_at);
      // Offset local timezone ISO formatting
      const tzOffset = d.getTimezoneOffset() * 60000;
      formattedDate = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    }

    this.formData = {
      title: r.title || '',
      category: r.category || 'Guías prácticas',
      summary: r.summary || '',
      body_markdown: r.body_markdown || '',
      external_url: r.external_url || '',
      is_featured: r.is_featured || false,
      published_at: formattedDate
    };
    this.showForm = true;
  }

  async deleteResource(id: string, title: string) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la guía "${title}"?`)) return;
    try {
      const { error } = await this.supabase.client
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Recurso eliminado correctamente');
      await this.loadResources();
    } catch (err: any) {
      alert(`Error al eliminar: ${err?.message || err}`);
    }
  }

  async saveResource() {
    if (!this.formData.title) return;
    this.saving = true;
    try {
      const payload = {
        title: this.formData.title.trim(),
        category: this.formData.category,
        summary: this.formData.summary.trim() || null,
        body_markdown: this.formData.body_markdown.trim() || null,
        external_url: this.formData.external_url.trim() || null,
        is_featured: this.formData.is_featured,
        published_at: this.formData.published_at ? new Date(this.formData.published_at).toISOString() : new Date().toISOString()
      };

      if (this.editId) {
        const { error } = await this.supabase.client
          .from('resources')
          .update(payload)
          .eq('id', this.editId);
        if (error) throw error;
      } else {
        const { error } = await this.supabase.client
          .from('resources')
          .insert(payload);
        if (error) throw error;
      }

      this.showForm = false;
      await this.loadResources();
    } catch (err: any) {
      alert(`Error al guardar: ${err?.message || err}`);
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.showForm = false;
    this.editId = null;
    this.formData = this.emptyFormData();
    this.uploading = false;
    this.uploadProgress = 0;
    this.uploadSuccess = false;
  }

  getCategoryBadgeClass(category: string): string {
    const map: Record<string, string> = {
      'Opciones de cuidado': 'b-perro',    // green
      'Financiación': 'b-pension',       // blue/indigo
      'Guías prácticas': 'b-gato',       // purple
      'Checklist': 'b-pendiente'         // yellow/orange
    };
    return map[category] || 'b-activo';
  }

  triggerFileInput() {
    const fileInput = document.getElementById('resourceFile') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  isUploadedUrl(url: string | null): boolean {
    if (!url) return false;
    return url.includes('/storage/v1/object/public/resource-files/');
  }

  removeUploadedFile() {
    this.formData.external_url = '';
    this.uploadSuccess = false;
    this.uploadProgress = 0;
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const limitBytes = 100 * 1024 * 1024;
    if (file.size > limitBytes) {
      alert('El archivo excede el límite de 100 MB.');
      input.value = '';
      return;
    }
    
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadSuccess = false;
    
    let simulatedProgressInterval: any;
    try {
      simulatedProgressInterval = setInterval(() => {
        if (this.uploadProgress < 90) {
          this.uploadProgress += Math.floor(Math.random() * 8) + 4;
        }
      }, 150);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `resources/${fileName}`;
      
      const { data, error } = await this.supabase.client.storage
        .from('resource-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) throw error;
      
      const { data: urlData } = this.supabase.client.storage
        .from('resource-files')
        .getPublicUrl(filePath);
        
      clearInterval(simulatedProgressInterval);
      this.formData.external_url = urlData.publicUrl;
      this.uploadSuccess = true;
      this.uploadProgress = 100;
    } catch (err: any) {
      if (simulatedProgressInterval) clearInterval(simulatedProgressInterval);
      console.error('Error uploading file:', err);
      alert(`Error al subir archivo: ${err?.message || err}`);
    } finally {
      this.uploading = false;
      input.value = '';
    }
  }

  private emptyFormData() {
    // Current time formatted for datetime-local input
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const nowLocal = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    return {
      title: '',
      category: 'Guías prácticas',
      summary: '',
      body_markdown: '',
      external_url: '',
      is_featured: false,
      published_at: nowLocal
    };
  }
}
