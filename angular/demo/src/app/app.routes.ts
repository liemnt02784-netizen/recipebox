import { Routes } from '@angular/router';
import { authGuard } from './auth-guard';
import { adminGuard } from './admin-guard';

export const routes: Routes = [
    { path: 'login', data: { mode: 'login' }, loadComponent: () => import('./auth-card/auth-card').then((m) => m.AuthCard) },
    { path: 'register', data: { mode: 'register' }, loadComponent: () => import('./auth-card/auth-card').then((m) => m.AuthCard) },
    { path: 'forgot-password', loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword) },
    { path: 'reset-password', loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword) },
    { path: 'help', loadComponent: () => import('./help/help').then((m) => m.Help) },
    { path: 'privacy', loadComponent: () => import('./privacy/privacy').then((m) => m.Privacy) },
    { path: 'terms', loadComponent: () => import('./terms/terms').then((m) => m.Terms) },
    { path: 'account', canActivate: [authGuard], loadComponent: () => import('./account/account').then((m) => m.Account) },
    { path: 'settings', canActivate: [authGuard], loadComponent: () => import('./settings/settings').then((m) => m.Settings) },
    { path: 'recipes', canActivate: [authGuard], loadComponent: () => import('./recipe-list/recipe-list').then((m) => m.RecipeList) },
     { path: 'recipes/:id',canActivate: [authGuard],loadComponent: () => import('./recipe-detail/recipe-detail').then((m) => m.RecipeDetail)},
    { path: 'orders', canActivate: [authGuard], loadComponent: () => import('./order-list/order-list').then((m) => m.OrderList) },

    // AD-09: khu vực quản trị tách bạch hoàn toàn khỏi trang xem/đặt món của user — route, component, guard riêng.
    { path: 'admin/orders', canActivate: [adminGuard], loadComponent: () => import('./admin-orders/admin-orders').then((m) => m.AdminOrders) },
    { path: 'admin/dashboard', canActivate: [adminGuard], loadComponent: () => import('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard) },
    { path: 'admin/admins', canActivate: [adminGuard], loadComponent: () => import('./admin-users/admin-users').then((m) => m.AdminUsers) },
    { path: 'admin/recipes', canActivate: [adminGuard], loadComponent: () => import('./admin-recipes/admin-recipes').then((m) => m.AdminRecipes) },
    { path: 'admin/recipes/new', canActivate: [adminGuard], loadComponent: () => import('./add-recipe/add-recipe').then((m) => m.AddRecipe) },
    { path: 'admin/recipes/:id/edit', canActivate: [adminGuard], loadComponent: () => import('./add-recipe/add-recipe').then((m) => m.AddRecipe) },

     { path: '', redirectTo: 'recipes',pathMatch:'full'},

    { path: '**', loadComponent: () => import('./not-found/not-found').then((m) => m.NotFound) },
];
