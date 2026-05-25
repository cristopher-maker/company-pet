import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { internalAdminGuard } from './core/guards/internal-admin.guard';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/auth/login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'register',
    loadChildren: () =>
      import('./pages/auth/register/register.module').then((m) => m.RegisterPageModule),
  },
  {
    path: 'reset-password',
    loadChildren: () =>
      import('./pages/auth/reset-password/reset-password.module').then(
        (m) => m.ResetPasswordPageModule
      ),
  },
  {
    path: 'dashboard',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/dashboard/dashboard.module').then((m) => m.DashboardPageModule),
  },
  {
    path: 'care-experts',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/care-experts/care-experts.module').then((m) => m.CareExpertsPageModule),
  },
  {
    path: 'providers',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/providers/providers.module').then((m) => m.ProvidersPageModule),
  },
  {
    path: 'resources',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/resources/resources.module').then((m) => m.ResourcesPageModule),
  },
  {
    path: 'training',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/training/training.module').then((m) => m.TrainingPageModule),
  },
  {
    path: 'requests',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/requests/requests.module').then((m) => m.RequestsPageModule),
  },
  {
    path: 'tasks',
    canMatch: [authGuard],
    loadChildren: () => import('./pages/tasks/tasks.module').then((m) => m.TasksPageModule),
  },
  {
    path: 'vouchers',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/vouchers/vouchers.module').then((m) => m.VouchersPageModule),
  },
  {
    path: 'company',
    canMatch: [authGuard],
    loadChildren: () => import('./pages/company/company.module').then((m) => m.CompanyPageModule),
  },
  {
    path: 'company-requests',
    canMatch: [authGuard],
    loadChildren: () =>
      import('./pages/company-requests/company-requests.module').then(
        (m) => m.CompanyRequestsPageModule
      ),
  },
  {
    path: 'profile',
    canMatch: [authGuard],
    loadChildren: () => import('./pages/profile/profile.module').then((m) => m.ProfilePageModule),
  },
  {
    path: 'admin',
    canMatch: [authGuard, internalAdminGuard],
    loadChildren: () => import('./pages/admin-dashboard/admin-dashboard.module').then(m => m.AdminDashboardModule),
  },
  {
    path: '**',
    loadChildren: () =>
      import('./pages/not-found/not-found.module').then((m) => m.NotFoundPageModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
      scrollPositionRestoration: 'enabled',
      useHash: true,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
