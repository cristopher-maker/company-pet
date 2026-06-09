import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService, ProfileRole } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { SupabaseService } from '../../core/services/supabase.service';

type ProfilePost = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  category: string;
  is_anonymous: boolean;
  created_at: string;
};

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  public loading = true;
  public saving = false;
  public fullName = '';
  public company = '';
  public companyTaxId = '';
  public email = '';
  public role: ProfileRole | null = null;
  public posts: ProfilePost[] = [];
  public postsLoading = true;
  public deletingPostId: string | null = null;

  constructor(
    public readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    public readonly ui: UiService
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  public roleLabel(value: ProfileRole | null): string {
    switch (value) {
      case 'admin':
        return 'Admin';
      case 'company_admin':
        return 'Administrador empresa';
      case 'manager':
        return 'Manager';
      case 'pet_expert':
        return 'Pet Expert';
      case 'employee':
        return 'Empleado';
      case 'cuidador':
        return 'Cuidador';
      default:
        return 'Sin rol';
    }
  }

  public async save(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.saving = true;
    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({
          full_name: this.fullName.trim() || null,
          company: this.company.trim() || null,
        } as any)
        .eq('id', userId);
      if (error) throw error;
      alert('Perfil actualizado.');
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo guardar el perfil.');
    } finally {
      this.saving = false;
    }
  }

  public async sendResetPassword(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;

    try {
      const redirectTo = `${window.location.origin}/#/reset-password`;
      await this.auth.sendPasswordReset(email, redirectTo);
      alert('Te enviamos un correo para restablecer contraseña.');
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo enviar el correo de recuperación.');
    }
  }

  public categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      stories: 'Historias',
      questions: 'Preguntas',
      health: 'Salud',
      care: 'Cuidados',
      adoption: 'Adopcion',
      events: 'Eventos',
    };
    return labels[category] ?? 'Comunidad';
  }

  public formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  public async deletePost(post: ProfilePost): Promise<void> {
    if (!confirm(`¿Eliminar la publicacion "${post.title}"? Esta accion no se puede deshacer.`)) return;

    this.deletingPostId = post.id;
    try {
      const { error } = await this.supabase.client.from('community_posts').delete().eq('id', post.id);
      if (error) throw error;

      const imagePath = this.communityImagePath(post.image_url);
      if (imagePath) {
        const { error: storageError } = await this.supabase.client.storage.from('community-post-images').remove([imagePath]);
        if (storageError) console.warn('No se pudo eliminar la imagen de la publicacion:', storageError);
      }

      this.posts = this.posts.filter((item) => item.id !== post.id);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo eliminar la publicacion.');
    } finally {
      this.deletingPostId = null;
    }
  }

  private async loadPosts(userId: string): Promise<void> {
    this.postsLoading = true;
    const { data, error } = await this.supabase.client
      .from('community_posts')
      .select('id,title,body,image_url,category,is_anonymous,created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    this.posts = error ? [] : (data ?? []) as ProfilePost[];
    this.postsLoading = false;
  }

  private communityImagePath(imageUrl: string | null): string | null {
    if (!imageUrl) return null;
    const marker = '/community-post-images/';
    const markerIndex = imageUrl.indexOf(marker);
    if (markerIndex < 0) return null;
    return decodeURIComponent(imageUrl.slice(markerIndex + marker.length).split('?')[0]);
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) {
      this.loading = false;
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('full_name, email, company, role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;

      this.fullName = (data?.full_name as string | undefined) ?? '';
      this.email = (data?.email as string | undefined) ?? this.auth.user?.email ?? '';
      this.company = (data?.company as string | undefined) ?? '';
      this.role = ((data?.role as ProfileRole | undefined) ?? null);

      const { data: membership } = await this.supabase.client
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      const companyId = (membership?.company_id as string | undefined) ?? null;
      if (companyId) {
        const { data: companyData } = await this.supabase.client
          .from('companies')
          .select('name, tax_id')
          .eq('id', companyId)
          .maybeSingle();

        if (companyData?.name && !this.company) {
          this.company = companyData.name as string;
        }
        this.companyTaxId = (companyData?.tax_id as string | undefined) ?? '';
      } else {
        this.companyTaxId = '';
      }
      await this.loadPosts(userId);
    } finally {
      this.loading = false;
    }
  }
}
