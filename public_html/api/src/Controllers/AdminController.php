<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Career;
use App\Models\FileRecord;
use App\Models\Institution;
use App\Models\Order;
use App\Models\Settings;
use App\Models\Subject;
use App\Models\User;
use App\Models\Year;
use App\Services\Emails;
use App\Services\PageCounter;
use App\Services\Thumbnailer;
use App\Services\Uploader;

/** Endpoints exclusivos del panel de administración. */
final class AdminController
{
    private const MESSAGE_STATUSES = ['no_leido', 'leido', 'respondido'];

    public function stats(Request $request): void
    {
        $stats = Order::stats();
        // Sin esto, las miniaturas de PDF dependen de que cada navegador las renderice
        // con PDF.js (más lento y menos confiable) en vez de servirlas ya generadas.
        $stats['thumbnailsServerSide'] = Thumbnailer::available();

        Response::json(['stats' => $stats]);
    }

    /** Lo que requiere atención: el panel lo muestra en el menú y en el resumen. */
    public function alerts(Request $request): void
    {
        Response::json([
            'unreadMessages' => (int) Database::selectOne(
                "SELECT COUNT(*) AS t FROM messages WHERE status = 'no_leido'",
            )['t'],
            'pendingOrders' => (int) Database::selectOne(
                "SELECT COUNT(*) AS t FROM orders WHERE status = 'pendiente'",
            )['t'],
        ]);
    }

    /** Contador de copias vendidas que el panel muestra siempre arriba. */
    public function copiesSold(Request $request): void
    {
        Response::json(['copiesSold' => Order::copiesSold()]);
    }

    // ---------- Precios ----------

    public function updateSettings(Request $request): void
    {
        $data = Validator::make($request->body())
            ->float('priceRing', 0, 999999)
            ->float('shippingPrice', 0, 999999)
            ->validated();

        Response::json([
            'settings' => Settings::update($data['priceRing'], $data['shippingPrice']),
        ]);
    }

    // ---------- Archivos: recálculo de hojas ----------

    /**
     * Recalcula las hojas de todos los archivos ya subidos (útil para los que quedaron
     * en 1 por defecto antes de esta función, o si se instala Imagick después).
     * Pisa cualquier corrección manual hecha desde el editor de archivos.
     */
    public function recountPages(Request $request): void
    {
        $files = Database::select('SELECT id, stored_name, mime_type FROM files');
        $updated = 0;

        foreach ($files as $file) {
            $pages = PageCounter::count(Uploader::path($file['stored_name']), $file['mime_type']);
            Database::execute('UPDATE files SET page_count = ? WHERE id = ?', [$pages, $file['id']]);
            $updated++;
        }

        Response::json(['updated' => $updated]);
    }

    // ---------- Pedidos ----------

    public function orders(Request $request): void
    {
        $status = (string) $request->query('status', '');

        if ($status !== '' && !in_array($status, Order::STATUSES, true)) {
            throw HttpException::badRequest('Estado desconocido');
        }

        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Order::SORTABLE, 'created_at');

        Response::json($page->response(
            Order::search($status, $search, $page),
            Order::countSearch($status, $search),
        ));
    }

    public function order(Request $request, array $params): void
    {
        $order = Order::find((int) $params['id']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        Response::json(['order' => $order]);
    }

    public function updateOrderStatus(Request $request, array $params): void
    {
        $data = Validator::make($request->body())->enum('status', Order::STATUSES)->validated();
        $order = Order::updateStatus((int) $params['id'], $data['status']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        Response::json(['order' => $order]);
    }

    public function deleteOrder(Request $request, array $params): void
    {
        Order::delete((int) $params['id']);
        Response::noContent();
    }

    /** Botón manual del admin para marcar pagado/pendiente un pedido "efectivo". */
    public function updateOrderPaymentStatus(Request $request, array $params): void
    {
        $data = Validator::make($request->body())->enum('paymentStatus', Order::PAYMENT_STATUSES)->validated();
        $order = Order::updatePaymentStatus((int) $params['id'], $data['paymentStatus']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        Response::json(['order' => $order]);
    }

    /**
     * Botón "Notificar al cliente": manda el mail de "listo para retirar" y, si el
     * pedido todavía estaba pendiente o en proceso, lo pasa a "listo".
     */
    public function notifyOrderReady(Request $request, array $params): void
    {
        $order = Order::find((int) $params['id']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        if ($order['delivery_method'] !== 'retiro') {
            throw HttpException::badRequest('Este pedido es con envío a domicilio, no se retira');
        }

        if (in_array($order['status'], ['entregado', 'cancelado'], true)) {
            throw HttpException::badRequest('El pedido ya está entregado o cancelado');
        }

        if (!Emails::orderReady($order)) {
            throw new HttpException(502, 'No se pudo enviar el correo. Revisá la configuración de mail e intentá de nuevo.');
        }

        Response::json(['order' => Order::markReadyNotified((int) $order['id'])]);
    }

    // ---------- Archivos ----------

    public function files(Request $request): void
    {
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, FileRecord::SORTABLE, 'created_at');

        Response::json($page->response(
            FileRecord::all($search, $page),
            FileRecord::countAll($search),
        ));
    }

    public function updateFile(Request $request, array $params): void
    {
        $file = FileRecord::find((int) $params['id']);

        if ($file === null) {
            throw HttpException::notFound('El archivo no existe');
        }

        $data = Validator::make($request->body())
            ->string('title', 1, 180)
            ->string('description', 0, 500, required: false)
            ->bool('isPublic')
            ->int('pageCount', 1, 5000, (int) $file['page_count'])
            ->validated();

        $optionalId = static fn (mixed $v): ?int => $v === null || $v === '' || $v === '0' ? null : (int) $v;

        $institutionId = $optionalId($request->input('institutionId'));
        $level = $request->input('level');
        $level = in_array($level, Year::LEVELS, true) ? $level : null;
        $careerId = $optionalId($request->input('careerId'));
        $yearId = $optionalId($request->input('yearId'));
        $subjectId = $optionalId($request->input('subjectId'));

        if ($institutionId !== null && Institution::find($institutionId) === null) {
            throw HttpException::badRequest('La institución indicada no existe');
        }

        if ($careerId !== null && Career::find($careerId) === null) {
            throw HttpException::badRequest('La carrera indicada no existe');
        }

        if ($yearId !== null && Year::find($yearId) === null) {
            throw HttpException::badRequest('El año indicado no existe');
        }

        if ($subjectId !== null && Subject::find($subjectId) === null) {
            throw HttpException::badRequest('La materia indicada no existe');
        }

        Response::json(['file' => FileRecord::update($file['id'], [
            'title' => $data['title'],
            'description' => $data['description'],
            'is_public' => $data['isPublic'],
            'institution_id' => $institutionId,
            'level' => $level,
            'career_id' => $careerId,
            'year_id' => $yearId,
            'subject_id' => $subjectId,
            'page_count' => $data['pageCount'],
        ])]);
    }

    public function deleteFile(Request $request, array $params): void
    {
        $file = FileRecord::find((int) $params['id']);

        if ($file === null) {
            throw HttpException::notFound('El archivo no existe');
        }

        if (FileRecord::isUsedInOrders($file['id'])) {
            throw HttpException::badRequest('No se puede borrar: forma parte de un pedido');
        }

        FileRecord::delete($file['id']);
        Uploader::remove($file['stored_name']);
        Thumbnailer::remove($file['stored_name']);

        Response::noContent();
    }

    // ---------- Clientes ----------

    public function clients(Request $request): void
    {
        $role = (string) $request->query('role', '');

        if ($role !== '' && !in_array($role, ['client', 'admin'], true)) {
            throw HttpException::badRequest('Rol desconocido');
        }

        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, User::SORTABLE, 'created_at');

        Response::json($page->response(
            User::all($search, $role, $page),
            User::count($search, $role),
        ));
    }

    public function createClient(Request $request): void
    {
        $data = Validator::make($request->body())
            ->string('name', 2, 120)
            ->email('email')
            ->password('password')
            ->string('phone', 0, 40, required: false)
            ->enum('role', ['client', 'admin'], 'client')
            ->validated();

        if (User::emailExists($data['email'])) {
            throw HttpException::badRequest('Ya existe una cuenta con ese email', ['email' => ['Email en uso']]);
        }

        $user = User::createWithRole($data['name'], $data['email'], $data['password'], $data['phone'], $data['role']);

        Response::json(['client' => $user], 201);
    }

    public function updateClient(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $current = User::find($id);

        if ($current === null) {
            throw HttpException::notFound('El usuario no existe');
        }

        $body = $request->body();
        $validator = Validator::make($body)
            ->string('name', 2, 120)
            ->email('email')
            ->string('phone', 0, 40, required: false)
            ->enum('role', ['client', 'admin'], $current['role']);

        if (!empty($body['password'])) {
            $validator->password('password');
        }

        $data = $validator->validated();

        if ($data['email'] !== $current['email'] && User::emailExists($data['email'])) {
            throw HttpException::badRequest('Ya existe una cuenta con ese email', ['email' => ['Email en uso']]);
        }

        // Evita quedarse sin ningún administrador.
        if ($current['role'] === 'admin' && $data['role'] !== 'admin' && User::countAdmins() <= 1) {
            throw HttpException::badRequest('Debe quedar al menos un administrador');
        }

        Response::json(['client' => User::update($id, $data)]);
    }

    public function deleteClient(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $user = User::find($id);

        if ($user === null) {
            throw HttpException::notFound('El usuario no existe');
        }

        if ($id === Auth::id()) {
            throw HttpException::badRequest('No podés eliminar tu propio usuario');
        }

        if ($user['role'] === 'admin' && User::countAdmins() <= 1) {
            throw HttpException::badRequest('Debe quedar al menos un administrador');
        }

        // Los archivos se borran en cascada; hay que limpiar también el disco.
        $files = FileRecord::byUser($id);

        try {
            User::delete($id);
        } catch (\PDOException) {
            throw HttpException::badRequest(
                'No se puede eliminar: el cliente tiene archivos incluidos en pedidos. Borrá esos pedidos primero.',
            );
        }

        foreach ($files as $file) {
            Uploader::remove($file['stored_name']);
        }

        Response::noContent();
    }

    // ---------- Mensajes ----------

    public function messages(Request $request): void
    {
        $page = Paginator::fromRequest(
            $request,
            ['name' => 'name', 'email' => 'email', 'status' => 'status', 'created_at' => 'created_at'],
            'created_at',
        );

        $status = (string) $request->query('status', '');

        if ($status !== '' && !in_array($status, self::MESSAGE_STATUSES, true)) {
            throw HttpException::badRequest('Estado desconocido');
        }

        $where = $status === '' ? '' : 'WHERE status = ?';
        $bindings = $status === '' ? [] : [$status];

        Response::json($page->response(
            Database::select("SELECT * FROM messages {$where} " . $page->orderBy() . ' ' . $page->limit(), $bindings),
            (int) Database::selectOne("SELECT COUNT(*) AS total FROM messages {$where}", $bindings)['total'],
        ));
    }

    public function updateMessageStatus(Request $request, array $params): void
    {
        $data = Validator::make($request->body())->enum('status', self::MESSAGE_STATUSES)->validated();
        $id = (int) $params['id'];

        Database::execute('UPDATE messages SET status = ? WHERE id = ?', [$data['status'], $id]);
        $message = Database::selectOne('SELECT * FROM messages WHERE id = ?', [$id]);

        if ($message === null) {
            throw HttpException::notFound('El mensaje no existe');
        }

        Response::json(['message' => $message]);
    }

    public function deleteMessage(Request $request, array $params): void
    {
        Database::execute('DELETE FROM messages WHERE id = ?', [(int) $params['id']]);
        Response::noContent();
    }
}
