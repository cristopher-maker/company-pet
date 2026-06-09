import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';

type PostRow = {
  id: string;
  title: string;
  body: string;
  is_anonymous: boolean;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  author_id: string | null;
  author_name?: string;
  image_url?: string | null;
  category: CommunityCategory;
  like_count: number;
  comment_count: number;
  user_has_liked: boolean;
};

type CommunityCategory = 'stories' | 'questions' | 'health' | 'care' | 'adoption' | 'events';
type CategoryOption = { id: 'all' | CommunityCategory; label: string; icon: string };

type CommentRow = {
  id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  author_id: string | null;
  author_name?: string;
};

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  public loading = true;
  public posts: PostRow[] = [];
  public selectedPost: PostRow | null = null;
  public comments: CommentRow[] = [];
  public commentsLoading = false;

  public showNewPostForm = false;
  public newPost = { title: '', body: '', image_url: '', category: 'stories' as CommunityCategory, is_anonymous: false };
  public newPostSubmitting = false;
  public searchQuery = '';
  public activeCategory: 'all' | CommunityCategory = 'all';
  public readonly categoryOptions: CategoryOption[] = [
    { id: 'all', label: 'Todas', icon: 'apps' },
    { id: 'stories', label: 'Historias', icon: 'auto_stories' },
    { id: 'questions', label: 'Preguntas', icon: 'help_outline' },
    { id: 'health', label: 'Salud', icon: 'medical_services' },
    { id: 'care', label: 'Cuidados', icon: 'pets' },
    { id: 'adoption', label: 'Adopción', icon: 'volunteer_activism' },
    { id: 'events', label: 'Eventos', icon: 'event' },
  ];
  public selectedPostImage: File | null = null;
  public selectedPostImagePreview: string | null = null;

  public newCommentBody = '';
  public newCommentAnonymous = false;
  public newCommentSubmitting = false;

  public error: string | null = null;

  private userId: string | null = null;
  private companyId: string | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    public readonly auth: AuthService,
    public readonly ui: UiService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;

    const session = await this.supabase.client.auth.getSession();
    this.userId = session.data.session?.user?.id ?? null;
    if (!this.userId) {
      this.loading = false;
      return;
    }

    const { data: membership } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', this.userId)
      .maybeSingle();

    this.companyId = (membership?.company_id as string) ?? null;
    if (!this.companyId) {
      this.loading = false;
      return;
    }

    await this.loadPosts();

    this.loading = false;
  }

  private async loadPosts(): Promise<void> {
    if (!this.companyId) return;

    const { data, error } = await this.supabase.client
      .from('community_posts')
      .select('*, author:profiles!community_posts_author_id_fkey(full_name)')
      .eq('company_id', this.companyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      this.error = 'No se pudieron cargar las publicaciones.';
      return;
    }

    const rows = data ?? [];

    const { data: likesData } = await this.supabase.client
      .from('community_likes')
      .select('post_id,user_id');

    const likeCounts: Record<string, number> = {};
    const userLikes = new Set<string>();
    (likesData ?? []).forEach((l: any) => {
      likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
      if (l.user_id === this.userId) userLikes.add(l.post_id);
    });

    const { data: commentsData } = await this.supabase.client
      .from('community_comments')
      .select('post_id');

    const commentCounts: Record<string, number> = {};
    (commentsData ?? []).forEach((c: any) => {
      commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
    });

    this.posts = rows.map((p: any) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      is_anonymous: p.is_anonymous,
      is_pinned: p.is_pinned,
      tags: p.tags ?? [],
      created_at: p.created_at,
      author_id: p.author_id,
      image_url: p.image_url || null,
      category: p.category || 'stories',
      author_name: p.is_anonymous ? 'Anónimo' : (p.author?.full_name?.trim() || 'Usuario'),
      like_count: likeCounts[p.id] ?? 0,
      comment_count: commentCounts[p.id] ?? 0,
      user_has_liked: userLikes.has(p.id),
    })) as PostRow[];
  }

  public get filteredPosts(): PostRow[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.posts.filter((post) => {
      const matchesTag = this.activeCategory === 'all' || post.category === this.activeCategory;
      const matchesQuery = !query || [post.title, post.body, post.author_name, ...post.tags]
        .filter(Boolean).join(' ').toLowerCase().includes(query);
      return matchesTag && matchesQuery;
    });
  }

  public postVisualClass(post: PostRow): string {
    const classes: Record<CommunityCategory, string> = {
      stories: 'visual-community',
      questions: 'visual-cat',
      health: 'visual-health',
      care: 'visual-dog',
      adoption: 'visual-adoption',
      events: 'visual-events',
    };
    return classes[post.category] || 'visual-community';
  }

  public postVisualIcon(post: PostRow): string {
    const visual = this.postVisualClass(post);
    if (visual === 'visual-health') return 'medical_services';
    if (visual === 'visual-cat') return 'pets';
    if (visual === 'visual-dog') return 'directions_walk';
    if (visual === 'visual-adoption') return 'volunteer_activism';
    return 'forum';
  }

  public categoryLabel(category: CommunityCategory): string {
    return this.categoryOptions.find((option) => option.id === category)?.label ?? 'Comunidad';
  }

  public onPostImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) {
      input.value = '';
      this.error = 'La imagen debe ser JPG, PNG o WEBP y pesar menos de 8 MB.';
      return;
    }

    this.selectedPostImage = file;
    this.error = null;
    if (this.selectedPostImagePreview) URL.revokeObjectURL(this.selectedPostImagePreview);
    this.selectedPostImagePreview = URL.createObjectURL(file);
  }

  public clearPostImage(): void {
    this.selectedPostImage = null;
    if (this.selectedPostImagePreview) URL.revokeObjectURL(this.selectedPostImagePreview);
    this.selectedPostImagePreview = null;
  }

  public async openPost(post: PostRow): Promise<void> {
    this.selectedPost = post;
    this.comments = [];
    this.newCommentBody = '';
    this.newCommentAnonymous = false;
    this.commentsLoading = true;

    const { data, error } = await this.supabase.client
      .from('community_comments')
      .select('*, author:profiles!community_comments_author_id_fkey(full_name)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      this.comments = (data ?? []).map((c: any) => ({
        id: c.id,
        body: c.body,
        is_anonymous: c.is_anonymous,
        created_at: c.created_at,
        author_id: c.author_id,
        author_name: c.is_anonymous ? 'Anónimo' : (c.author?.full_name?.trim() || 'Usuario'),
      })) as CommentRow[];
    }

    this.commentsLoading = false;
  }

  public closePost(): void {
    this.selectedPost = null;
    this.comments = [];
  }

  public async toggleLike(post: PostRow): Promise<void> {
    if (!this.userId) return;

    if (post.user_has_liked) {
      const { error } = await this.supabase.client
        .from('community_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', this.userId);

      if (!error) {
        post.user_has_liked = false;
        post.like_count = Math.max(0, post.like_count - 1);
      }
    } else {
      const { error } = await this.supabase.client
        .from('community_likes')
        .insert({ post_id: post.id, user_id: this.userId });

      if (!error) {
        post.user_has_liked = true;
        post.like_count += 1;
      }
    }
  }

  public async submitPost(): Promise<void> {
    if (!this.companyId || !this.userId) return;
    if (!this.newPost.title.trim() || !this.newPost.body.trim()) return;

    this.newPostSubmitting = true;
    this.error = null;

    let imageUrl: string | null = null;
    let uploadedImagePath: string | null = null;
    if (this.selectedPostImage) {
      const safeName = this.selectedPostImage.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .toLowerCase();
      const path = `${this.companyId}/${this.userId}/${Date.now()}-${safeName || 'imagen'}`;
      const { error: uploadError } = await this.supabase.client.storage
        .from('community-post-images')
        .upload(path, this.selectedPostImage, { contentType: this.selectedPostImage.type, upsert: false });
      if (uploadError) {
        console.error('Error subiendo imagen de comunidad:', uploadError);
        this.error = `No se pudo subir la imagen: ${uploadError.message}`;
        this.newPostSubmitting = false;
        return;
      }
      uploadedImagePath = path;
      imageUrl = this.supabase.client.storage.from('community-post-images').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await this.supabase.client
      .from('community_posts')
      .insert({
        company_id: this.companyId,
        author_id: this.userId,
        title: this.newPost.title.trim(),
        body: this.newPost.body.trim(),
        image_url: imageUrl,
        category: this.newPost.category,
        is_anonymous: this.newPost.is_anonymous,
        tags: [],
      });

    if (error) {
      if (uploadedImagePath) {
        await this.supabase.client.storage.from('community-post-images').remove([uploadedImagePath]);
      }
      console.error('Error creando publicación de comunidad:', error);
      this.error = `No se pudo publicar: ${error.message}`;
      this.newPostSubmitting = false;
      return;
    }

    this.newPost = { title: '', body: '', image_url: '', category: 'stories', is_anonymous: false };
    this.clearPostImage();
    this.showNewPostForm = false;
    this.newPostSubmitting = false;
    await this.loadPosts();
  }

  public async submitComment(): Promise<void> {
    if (!this.selectedPost || !this.userId) return;
    if (!this.newCommentBody.trim()) return;

    this.newCommentSubmitting = true;
    this.error = null;

    const { error } = await this.supabase.client
      .from('community_comments')
      .insert({
        post_id: this.selectedPost.id,
        author_id: this.userId,
        body: this.newCommentBody.trim(),
        is_anonymous: this.newCommentAnonymous,
      });

    if (error) {
      this.error = 'No se pudo enviar el comentario.';
      this.newCommentSubmitting = false;
      return;
    }

    this.newCommentBody = '';
    this.selectedPost.comment_count += 1;
    await this.openPost(this.selectedPost);
    this.newCommentSubmitting = false;
  }

  public trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  public formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
