<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\MpAccount;
use App\Services\MercadoPago;

/** Panel: cuentas de Mercado Pago y en cuál cobra cada punto de retiro. */
final class MpAccountController
{
    public function index(Request $request): void
    {
        Response::json([
            'accounts' => MpAccount::all(),
            // Para avisar en el panel qué pasa si no hay cuentas cargadas.
            'configFallback' => (string) Config::get('mercadopago.access_token', '') !== '',
        ]);
    }

    public function store(Request $request): void
    {
        $data = Validator::make($request->body())
            ->string('name', 2, 120)
            ->string('accessToken', 20, 300)
            ->bool('isDefault')
            ->validated();

        $this->ensureNameFree($data['name']);
        $mpUser = $this->verifyToken($data['accessToken']);

        Response::json(['account' => MpAccount::create($data['name'], $data['accessToken'], $mpUser, $data['isDefault'])], 201);
    }

    /** Cambia el nombre y, si se manda, el access token (vacío = se deja el que estaba). */
    public function update(Request $request, array $params): void
    {
        $id = $this->existing($params);

        $data = Validator::make($request->body())
            ->string('name', 2, 120)
            ->string('accessToken', 0, 300, required: false)
            ->validated();

        $this->ensureNameFree($data['name'], $id);
        $token = trim((string) ($data['accessToken'] ?? ''));

        if ($token !== '') {
            MpAccount::replaceToken($id, $token, $this->verifyToken($token));
        }

        MpAccount::rename($id, $data['name']);

        Response::json(['account' => MpAccount::find($id)]);
    }

    public function makeDefault(Request $request, array $params): void
    {
        $id = $this->existing($params);

        if (!MpAccount::isActive($id)) {
            throw HttpException::badRequest('Una cuenta archivada no puede ser la principal: primero restaurala');
        }

        MpAccount::makeDefault($id);

        Response::json(['account' => MpAccount::find($id)]);
    }

    public function archive(Request $request, array $params): void
    {
        $id = $this->existing($params);
        $account = MpAccount::find($id);
        $othersActive = array_filter(
            MpAccount::all(),
            static fn (array $other): bool => (int) $other['id'] !== $id && (int) $other['is_active'] === 1,
        );

        // Si se archivara la principal habiendo otras, los envíos pasarían en silencio al
        // token de config.php. Mejor que el admin elija a mano cuál es la nueva principal.
        if ((int) $account['is_default'] === 1 && $othersActive !== []) {
            throw HttpException::badRequest('Es la cuenta principal: antes de archivarla, marcá otra como principal');
        }

        MpAccount::archive($id);

        Response::json(['account' => MpAccount::find($id)]);
    }

    public function restore(Request $request, array $params): void
    {
        $id = $this->existing($params);
        MpAccount::restore($id);

        Response::json(['account' => MpAccount::find($id)]);
    }

    private function existing(array $params): int
    {
        $id = (int) $params['id'];

        if (MpAccount::find($id) === null) {
            throw HttpException::notFound('La cuenta no existe');
        }

        return $id;
    }

    private function ensureNameFree(string $name, ?int $exceptId = null): void
    {
        if (MpAccount::nameTaken($name, $exceptId)) {
            throw HttpException::badRequest('Ya hay una cuenta con ese nombre', ['name' => ['Nombre repetido']]);
        }
    }

    /** Pregunta a Mercado Pago de quién es el token: si no responde, no se guarda. */
    private function verifyToken(string $accessToken): array
    {
        $mpUser = MercadoPago::accountForToken($accessToken);

        if ($mpUser === null) {
            throw HttpException::badRequest(
                'Mercado Pago no reconoció ese access token. Revisá que esté completo y que sea el de producción.',
                ['accessToken' => ['Token inválido']],
            );
        }

        return $mpUser;
    }
}
