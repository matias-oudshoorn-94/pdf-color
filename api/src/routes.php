<?php

declare(strict_types=1);

use App\Controllers\AdminController;
use App\Controllers\AuthController;
use App\Controllers\ContactController;
use App\Controllers\FileController;
use App\Controllers\OrderController;
use App\Controllers\ReportsController;
use App\Controllers\SettingsController;
use App\Controllers\TaxonomyAdminController;
use App\Controllers\TaxonomyController;
use App\Controllers\WebhookController;
use App\Core\Auth;
use App\Core\Recaptcha;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

/**
 * Mapa de endpoints. Para sumar uno nuevo: creá el método en el controlador
 * y agregá la línea acá con sus middlewares.
 */

$router = new Router();

$auth = [Auth::required()];
$admin = [Auth::adminOnly()];

$router->get('/health', static fn (Request $r) => Response::json(['ok' => true, 'time' => date('c')]));

// Sesión
$router->post('/auth/register', [new AuthController(), 'register'], [Recaptcha::verify('register')]);
$router->post('/auth/login', [new AuthController(), 'login'], [Recaptcha::verify('login')]);
$router->post('/auth/google', [new AuthController(), 'google']);
$router->post('/auth/forgot-password', [new AuthController(), 'forgotPassword'], [Recaptcha::verify('forgot_password')]);
$router->post('/auth/reset-password', [new AuthController(), 'resetPassword'], [Recaptcha::verify('reset_password')]);
$router->post('/auth/logout', [new AuthController(), 'logout']);
$router->get('/auth/me', [new AuthController(), 'me']);
$router->patch('/auth/profile', [new AuthController(), 'updateProfile'], $auth);

// Archivos
// Catálogo, vista previa y subida son públicos: la cuenta se pide recién al confirmar el pedido.
$router->get('/files', [new FileController(), 'index']);
$router->get('/files/mine', [new FileController(), 'mine'], $auth);
$router->get('/files/duplicates', [new FileController(), 'duplicates']);
$router->post('/files', [new FileController(), 'store'], [Recaptcha::verify('upload')]);
$router->get('/files/{id}/download', [new FileController(), 'download'], $auth);
$router->get('/files/{id}/preview', [new FileController(), 'preview']);
$router->get('/files/{id}/thumb', [new FileController(), 'thumb']);
$router->get('/files/{id}/rating', [new FileController(), 'rating']);
$router->patch('/files/{id}/rating', [new FileController(), 'rate'], $auth);
$router->delete('/files/{id}', [new FileController(), 'destroy'], $auth);

// Pedidos
$router->post('/orders', [new OrderController(), 'store'], [...$auth, Recaptcha::verify('checkout')]);
$router->get('/orders/mine', [new OrderController(), 'mine'], $auth);
$router->get('/orders/admin', [new OrderController(), 'index'], $admin);
// Sin sesión obligatoria: la vuelta de Mercado Pago puede caer en otro navegador
// (ej: paga desde la app en el celular). El controlador valida dueño o preference_id.
$router->get('/orders/pending/{id}', [new OrderController(), 'pending']);
$router->get('/orders/{id}', [new OrderController(), 'show'], $auth);
$router->patch('/orders/{id}/status', [new OrderController(), 'updateStatus'], $admin);

// Contacto
$router->get('/contact', [new ContactController(), 'info']);
$router->post('/contact', [new ContactController(), 'store']);

// Webhooks de terceros (sin sesión ni CSRF, ver Core/Csrf.php)
$router->post('/webhooks/mercadopago', [new WebhookController(), 'mercadopago']);

// Localidades / instituciones / cursos (lectura para el sitio)
$taxonomy = new TaxonomyController();

$router->get('/settings', [new SettingsController(), 'show']);

$router->get('/locations', [$taxonomy, 'locations']);
$router->get('/institutions', [$taxonomy, 'institutions']);
$router->get('/careers', [$taxonomy, 'careers']);
$router->get('/years', [$taxonomy, 'years']);
$router->get('/subjects', [$taxonomy, 'subjects']);
$router->get('/pickup-points', [$taxonomy, 'pickupPoints']);

// Altas desde la subida de archivos (públicas, como la subida): reCAPTCHA contra bots,
// límite por IP y control de parecidos en el controlador para no duplicar.
$router->get('/taxonomy/similar', [$taxonomy, 'similar']);
$router->post('/institutions', [$taxonomy, 'createInstitution'], [Recaptcha::verify('taxonomy_create')]);
$router->post('/careers', [$taxonomy, 'createCareer'], [Recaptcha::verify('taxonomy_create')]);
$router->post('/subjects', [$taxonomy, 'createSubject'], [Recaptcha::verify('taxonomy_create')]);
$router->get('/discount-tiers', [$taxonomy, 'discountTiers']);

// Panel de administración
$adminController = new AdminController();

$router->get('/admin/stats', [$adminController, 'stats'], $admin);
$router->get('/admin/copies-sold', [$adminController, 'copiesSold'], $admin);
$router->patch('/admin/settings', [$adminController, 'updateSettings'], $admin);
$router->post('/admin/files/recount-pages', [$adminController, 'recountPages'], $admin);

$router->get('/admin/orders', [$adminController, 'orders'], $admin);
$router->get('/admin/orders/{id}', [$adminController, 'order'], $admin);
$router->patch('/admin/orders/{id}/status', [$adminController, 'updateOrderStatus'], $admin);
$router->patch('/admin/orders/{id}/payment-status', [$adminController, 'updateOrderPaymentStatus'], $admin);
$router->post('/admin/orders/{id}/notify-ready', [$adminController, 'notifyOrderReady'], $admin);
$router->delete('/admin/orders/{id}', [$adminController, 'deleteOrder'], $admin);

$router->get('/admin/files', [$adminController, 'files'], $admin);
$router->patch('/admin/files/{id}', [$adminController, 'updateFile'], $admin);
$router->delete('/admin/files/{id}', [$adminController, 'deleteFile'], $admin);

$router->get('/admin/clients', [$adminController, 'clients'], $admin);
$router->post('/admin/clients', [$adminController, 'createClient'], $admin);
$router->patch('/admin/clients/{id}', [$adminController, 'updateClient'], $admin);
$router->delete('/admin/clients/{id}', [$adminController, 'deleteClient'], $admin);

$router->get('/admin/messages', [$adminController, 'messages'], $admin);
$router->delete('/admin/messages/{id}', [$adminController, 'deleteMessage'], $admin);

// Reportes
$reportsController = new ReportsController();

$router->get('/admin/reports/sales', [$reportsController, 'sales'], $admin);
$router->get('/admin/reports/overview', [$reportsController, 'overview'], $admin);
$router->get('/admin/reports/rankings', [$reportsController, 'rankings'], $admin);

// ABM de localidades, instituciones y cursos
$taxonomyAdmin = new TaxonomyAdminController();

$router->get('/admin/locations', [$taxonomyAdmin, 'locations'], $admin);
$router->post('/admin/locations', [$taxonomyAdmin, 'createLocation'], $admin);
$router->patch('/admin/locations/{id}', [$taxonomyAdmin, 'updateLocation'], $admin);
$router->delete('/admin/locations/{id}', [$taxonomyAdmin, 'deleteLocation'], $admin);

$router->get('/admin/institutions', [$taxonomyAdmin, 'institutions'], $admin);
$router->post('/admin/institutions', [$taxonomyAdmin, 'createInstitution'], $admin);
$router->patch('/admin/institutions/{id}', [$taxonomyAdmin, 'updateInstitution'], $admin);
$router->delete('/admin/institutions/{id}', [$taxonomyAdmin, 'deleteInstitution'], $admin);

$router->get('/admin/careers', [$taxonomyAdmin, 'careers'], $admin);
$router->post('/admin/careers', [$taxonomyAdmin, 'createCareer'], $admin);
$router->patch('/admin/careers/{id}', [$taxonomyAdmin, 'updateCareer'], $admin);
$router->delete('/admin/careers/{id}', [$taxonomyAdmin, 'deleteCareer'], $admin);

$router->get('/admin/years', [$taxonomyAdmin, 'years'], $admin);
$router->post('/admin/years', [$taxonomyAdmin, 'createYear'], $admin);
$router->patch('/admin/years/{id}', [$taxonomyAdmin, 'updateYear'], $admin);
$router->delete('/admin/years/{id}', [$taxonomyAdmin, 'deleteYear'], $admin);

$router->get('/admin/subjects', [$taxonomyAdmin, 'subjects'], $admin);
$router->post('/admin/subjects', [$taxonomyAdmin, 'createSubject'], $admin);
$router->patch('/admin/subjects/{id}', [$taxonomyAdmin, 'updateSubject'], $admin);
$router->delete('/admin/subjects/{id}', [$taxonomyAdmin, 'deleteSubject'], $admin);

$router->get('/admin/pickup-points', [$taxonomyAdmin, 'pickupPoints'], $admin);
$router->post('/admin/pickup-points', [$taxonomyAdmin, 'createPickupPoint'], $admin);
$router->patch('/admin/pickup-points/{id}', [$taxonomyAdmin, 'updatePickupPoint'], $admin);
$router->delete('/admin/pickup-points/{id}', [$taxonomyAdmin, 'deletePickupPoint'], $admin);

$router->get('/admin/discount-tiers', [$taxonomyAdmin, 'discountTiers'], $admin);
$router->post('/admin/discount-tiers', [$taxonomyAdmin, 'createDiscountTier'], $admin);
$router->patch('/admin/discount-tiers/{id}', [$taxonomyAdmin, 'updateDiscountTier'], $admin);
$router->delete('/admin/discount-tiers/{id}', [$taxonomyAdmin, 'deleteDiscountTier'], $admin);

return $router;
