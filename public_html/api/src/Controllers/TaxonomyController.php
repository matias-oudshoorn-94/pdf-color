<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Career;
use App\Models\Institution;
use App\Models\Location;
use App\Models\PickupPoint;
use App\Models\PriceTier;
use App\Models\Subject;
use App\Models\Year;
use App\Services\Similarity;

/** Lectura de localidades, instituciones, años, carreras, materias, puntos de retiro y descuentos para el sitio. */
final class TaxonomyController
{
    public function locations(Request $request): void
    {
        Response::json(['locations' => Location::all()]);
    }

    public function subjects(Request $request): void
    {
        Response::json(['subjects' => Subject::all()]);
    }

    public function institutions(Request $request): void
    {
        $locationId = $request->query('locationId');

        Response::json([
            'institutions' => Institution::all('', $locationId !== null && $locationId !== '' ? (int) $locationId : null),
        ]);
    }

    public function years(Request $request): void
    {
        $level = $request->query('level');

        if ($level === null || $level === '' || !in_array($level, Year::LEVELS, true)) {
            throw HttpException::badRequest('Indicá el nivel educativo');
        }

        Response::json(['years' => Year::all('', $level)]);
    }

    public function careers(Request $request): void
    {
        Response::json(['careers' => Career::all()]);
    }

    // ---------- Altas hechas por usuarios desde la subida de archivos ----------

    /** Tipos que un usuario puede cargar: [máximo de caracteres del nombre, etiqueta de la respuesta]. */
    private const USER_TYPES = [
        'institution' => [160, 'institution'],
        'career' => [160, 'career'],
        'subject' => [120, 'subject'],
    ];

    /**
     * Parecidos a un nombre mientras el usuario lo escribe, para que elija uno
     * existente en vez de cargar un duplicado. No escribe nada.
     */
    public function similar(Request $request): void
    {
        $type = (string) $request->query('type', '');
        $name = trim((string) $request->query('name', ''));
        $locationId = (int) $request->query('locationId', 0);

        if (!isset(self::USER_TYPES[$type])) {
            throw HttpException::badRequest('Tipo inválido');
        }

        if (mb_strlen($name) < 2 || ($type === 'institution' && $locationId <= 0)) {
            Response::json(['similar' => []]);

            return;
        }

        Response::json(['similar' => Similarity::rank($name, $this->candidates($type, $locationId))]);
    }

    public function createInstitution(Request $request): void
    {
        $this->createByUser($request, 'institution');
    }

    public function createCareer(Request $request): void
    {
        $this->createByUser($request, 'career');
    }

    public function createSubject(Request $request): void
    {
        $this->createByUser($request, 'subject');
    }

    /**
     * Alta con tres salidas para no duplicar:
     *  - ya existe con otra escritura ("matematica" = "Matemática") → 200 con la existente;
     *  - hay parecidas y el usuario todavía no confirmó → 409 con la lista para que elija;
     *  - nada parecido (o confirmó que es distinta) → 201 con la nueva.
     */
    private function createByUser(Request $request, string $type): void
    {
        RateLimiter::hit('taxonomy_create', $request->ip(), 20, 3600);

        [$maxLength, $key] = self::USER_TYPES[$type];

        $validator = Validator::make($request->body())
            ->string('name', 2, $maxLength)
            ->bool('force');

        if ($type === 'institution') {
            $validator->int('locationId', 1, PHP_INT_MAX);
        }

        $data = $validator->validated();
        $locationId = $data['locationId'] ?? 0;
        $name = Similarity::tidy($data['name']);

        if ($type === 'institution' && Location::find($locationId) === null) {
            throw HttpException::badRequest('La localidad indicada no existe');
        }

        if (!preg_match('/[\p{L}\d]/u', $name)) {
            throw HttpException::badRequest('Escribí un nombre válido', ['name' => ['Nombre inválido']]);
        }

        $similar = Similarity::rank($name, $this->candidates($type, $locationId));
        $existing = $similar !== [] && $similar[0]['exact'] ? $similar[0] : null;

        if ($existing !== null) {
            Response::json([$key => $existing, 'created' => false]);

            return;
        }

        if ($similar !== [] && !$data['force']) {
            throw new HttpException(409, 'Encontramos opciones parecidas ya cargadas', ['similar' => $similar]);
        }

        try {
            $item = match ($type) {
                'institution' => Institution::create($locationId, $name, true),
                'career' => Career::create($name, true),
                'subject' => Subject::create($name, true),
            };
        } catch (\PDOException $e) {
            // Otro usuario la cargó en el mismo instante: la clave única lo frena y se reutiliza.
            if ($e->getCode() !== '23000') {
                throw $e;
            }

            $item = Similarity::rank($name, $this->candidates($type, $locationId), 1)[0] ?? null;

            if ($item === null) {
                throw $e;
            }

            Response::json([$key => $item, 'created' => false]);

            return;
        }

        Response::json([$key => $item, 'created' => true], 201);
    }

    private function candidates(string $type, int $locationId): array
    {
        return match ($type) {
            // Las instituciones se comparan dentro de la misma localidad: "Escuela 5"
            // de Mar del Plata y de Azul son escuelas distintas.
            'institution' => Institution::all('', $locationId),
            'career' => Career::all(),
            'subject' => Subject::all(),
        };
    }

    public function pickupPoints(Request $request): void
    {
        Response::json(['pickupPoints' => PickupPoint::active()]);
    }

    /** Precios por cantidad para el estimado en vivo del carrito y la subida. */
    public function priceTiers(Request $request): void
    {
        Response::json(['priceTiers' => PriceTier::grouped()]);
    }
}
