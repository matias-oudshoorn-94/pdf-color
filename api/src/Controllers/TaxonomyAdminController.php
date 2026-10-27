<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Career;
use App\Models\DiscountTier;
use App\Models\Institution;
use App\Models\Location;
use App\Models\PickupPoint;
use App\Models\Subject;
use App\Models\Year;

/** ABM de localidades, instituciones, años, carreras, materias, puntos de retiro y descuentos. Solo administradores. */
final class TaxonomyAdminController
{
    // ---------- Localidades ----------

    public function locations(Request $request): void
    {
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Location::SORTABLE, 'name');

        Response::json($page->response(Location::all($search, $page), Location::count($search)));
    }

    public function createLocation(Request $request): void
    {
        $data = Validator::make($request->body())->string('name', 2, 120)->validated();

        if (Location::nameTaken($data['name'])) {
            throw HttpException::badRequest('Ya existe una localidad con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['location' => Location::create($data['name'])], 201);
    }

    public function updateLocation(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Location::find($id) === null) {
            throw HttpException::notFound('La localidad no existe');
        }

        $data = Validator::make($request->body())->string('name', 2, 120)->validated();

        if (Location::nameTaken($data['name'], $id)) {
            throw HttpException::badRequest('Ya existe una localidad con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['location' => Location::update($id, $data['name'])]);
    }

    public function deleteLocation(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Location::hasInstitutions($id)) {
            throw HttpException::badRequest('No se puede borrar: la localidad tiene instituciones cargadas');
        }

        Location::delete($id);
        Response::noContent();
    }

    // ---------- Instituciones ----------

    public function institutions(Request $request): void
    {
        $locationId = $request->query('locationId');
        $locationId = $locationId !== null && $locationId !== '' ? (int) $locationId : null;
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Institution::SORTABLE, 'name');

        Response::json($page->response(
            Institution::all($search, $locationId, $page),
            Institution::count($search, $locationId),
        ));
    }

    public function createInstitution(Request $request): void
    {
        $data = $this->validateInstitution($request);

        if (Institution::nameTaken($data['locationId'], $data['name'])) {
            throw HttpException::badRequest('Esa institución ya existe en la localidad', ['name' => ['Nombre repetido']]);
        }

        Response::json(['institution' => Institution::create($data['locationId'], $data['name'])], 201);
    }

    public function updateInstitution(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Institution::find($id) === null) {
            throw HttpException::notFound('La institución no existe');
        }

        $data = $this->validateInstitution($request);

        if (Institution::nameTaken($data['locationId'], $data['name'], $id)) {
            throw HttpException::badRequest('Esa institución ya existe en la localidad', ['name' => ['Nombre repetido']]);
        }

        Response::json(['institution' => Institution::update($id, $data['locationId'], $data['name'])]);
    }

    public function deleteInstitution(Request $request, array $params): void
    {
        if (Institution::find((int) $params['id']) === null) {
            throw HttpException::notFound('La institución no existe');
        }

        // Es un dato más del archivo (como la materia): borrarla no borra archivos, solo los deja sin institución.
        Institution::delete((int) $params['id']);
        Response::noContent();
    }

    // ---------- Años ----------

    public function years(Request $request): void
    {
        $level = $request->query('level');
        $level = $level !== null && $level !== '' ? $level : null;
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Year::SORTABLE, 'name');

        Response::json($page->response(Year::all($search, $level, $page), Year::count($search, $level)));
    }

    public function createYear(Request $request): void
    {
        $data = $this->validateYear($request);

        if (Year::nameTaken($data['level'], $data['name'])) {
            throw HttpException::badRequest('Ese año ya existe para ese nivel', ['name' => ['Nombre repetido']]);
        }

        Response::json(['year' => Year::create($data['level'], $data['name'])], 201);
    }

    public function updateYear(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Year::find($id) === null) {
            throw HttpException::notFound('El año no existe');
        }

        $data = $this->validateYear($request);

        if (Year::nameTaken($data['level'], $data['name'], $id)) {
            throw HttpException::badRequest('Ese año ya existe para ese nivel', ['name' => ['Nombre repetido']]);
        }

        Response::json(['year' => Year::update($id, $data['level'], $data['name'])]);
    }

    public function deleteYear(Request $request, array $params): void
    {
        if (Year::find((int) $params['id']) === null) {
            throw HttpException::notFound('El año no existe');
        }

        Year::delete((int) $params['id']);
        Response::noContent();
    }

    private function validateYear(Request $request): array
    {
        return Validator::make($request->body())
            ->enum('level', Year::LEVELS)
            ->string('name', 1, 40)
            ->validated();
    }

    private function validateInstitution(Request $request): array
    {
        $data = Validator::make($request->body())
            ->string('name', 2, 160)
            ->int('locationId', 1, PHP_INT_MAX)
            ->validated();

        if (Location::find($data['locationId']) === null) {
            throw HttpException::badRequest('La localidad indicada no existe');
        }

        return $data;
    }

    // ---------- Materias ----------

    public function subjects(Request $request): void
    {
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Subject::SORTABLE, 'name');

        Response::json($page->response(Subject::all($search, $page), Subject::count($search)));
    }

    public function createSubject(Request $request): void
    {
        $data = Validator::make($request->body())->string('name', 2, 120)->validated();

        if (Subject::nameTaken($data['name'])) {
            throw HttpException::badRequest('Ya existe una materia con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['subject' => Subject::create($data['name'])], 201);
    }

    public function updateSubject(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Subject::find($id) === null) {
            throw HttpException::notFound('La materia no existe');
        }

        $data = Validator::make($request->body())->string('name', 2, 120)->validated();

        if (Subject::nameTaken($data['name'], $id)) {
            throw HttpException::badRequest('Ya existe una materia con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['subject' => Subject::update($id, $data['name'])]);
    }

    public function deleteSubject(Request $request, array $params): void
    {
        Subject::delete((int) $params['id']);
        Response::noContent();
    }

    // ---------- Carreras ----------

    public function careers(Request $request): void
    {
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, Career::SORTABLE, 'name');

        Response::json($page->response(Career::all($search, $page), Career::count($search)));
    }

    public function createCareer(Request $request): void
    {
        $data = Validator::make($request->body())->string('name', 2, 160)->validated();

        if (Career::nameTaken($data['name'])) {
            throw HttpException::badRequest('Ya existe una carrera con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['career' => Career::create($data['name'])], 201);
    }

    public function updateCareer(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (Career::find($id) === null) {
            throw HttpException::notFound('La carrera no existe');
        }

        $data = Validator::make($request->body())->string('name', 2, 160)->validated();

        if (Career::nameTaken($data['name'], $id)) {
            throw HttpException::badRequest('Ya existe una carrera con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json(['career' => Career::update($id, $data['name'])]);
    }

    public function deleteCareer(Request $request, array $params): void
    {
        if (Career::find((int) $params['id']) === null) {
            throw HttpException::notFound('La carrera no existe');
        }

        Career::delete((int) $params['id']);
        Response::noContent();
    }

    // ---------- Puntos de retiro ----------

    public function pickupPoints(Request $request): void
    {
        $search = trim((string) $request->query('search', ''));
        $page = Paginator::fromRequest($request, PickupPoint::SORTABLE, 'name');

        Response::json($page->response(PickupPoint::all($search, $page), PickupPoint::count($search)));
    }

    public function createPickupPoint(Request $request): void
    {
        $data = $this->validatePickupPoint($request);

        if (PickupPoint::nameTaken($data['name'])) {
            throw HttpException::badRequest('Ya existe un punto de retiro con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json([
            'pickupPoint' => PickupPoint::create($data['name'], $data['address'], $data['notes'], $data['isActive']),
        ], 201);
    }

    public function updatePickupPoint(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (PickupPoint::find($id) === null) {
            throw HttpException::notFound('El punto de retiro no existe');
        }

        $data = $this->validatePickupPoint($request);

        if (PickupPoint::nameTaken($data['name'], $id)) {
            throw HttpException::badRequest('Ya existe un punto de retiro con ese nombre', ['name' => ['Nombre repetido']]);
        }

        Response::json([
            'pickupPoint' => PickupPoint::update($id, $data['name'], $data['address'], $data['notes'], $data['isActive']),
        ]);
    }

    public function deletePickupPoint(Request $request, array $params): void
    {
        if (PickupPoint::find((int) $params['id']) === null) {
            throw HttpException::notFound('El punto de retiro no existe');
        }

        // Pedidos viejos quedan con pickup_point_id en null (ON DELETE SET NULL), no se borran.
        PickupPoint::delete((int) $params['id']);
        Response::noContent();
    }

    private function validatePickupPoint(Request $request): array
    {
        return Validator::make($request->body())
            ->string('name', 2, 120)
            ->string('address', 5, 300)
            ->string('notes', 0, 300, required: false)
            ->bool('isActive')
            ->validated();
    }

    // ---------- Descuentos por cantidad ----------

    public function discountTiers(Request $request): void
    {
        $page = Paginator::fromRequest($request, DiscountTier::SORTABLE, 'min_pages');

        Response::json($page->response(DiscountTier::all($page), DiscountTier::count()));
    }

    public function createDiscountTier(Request $request): void
    {
        $data = $this->validateDiscountTier($request);

        if (DiscountTier::minPagesTaken($data['minPages'])) {
            throw HttpException::badRequest(
                'Ya existe un escalón a partir de esa cantidad de páginas',
                ['minPages' => ['Valor repetido']],
            );
        }

        Response::json(['discountTier' => DiscountTier::create($data['minPages'], $data['discountPercent'])], 201);
    }

    public function updateDiscountTier(Request $request, array $params): void
    {
        $id = (int) $params['id'];

        if (DiscountTier::find($id) === null) {
            throw HttpException::notFound('El escalón no existe');
        }

        $data = $this->validateDiscountTier($request);

        if (DiscountTier::minPagesTaken($data['minPages'], $id)) {
            throw HttpException::badRequest(
                'Ya existe un escalón a partir de esa cantidad de páginas',
                ['minPages' => ['Valor repetido']],
            );
        }

        Response::json(['discountTier' => DiscountTier::update($id, $data['minPages'], $data['discountPercent'])]);
    }

    public function deleteDiscountTier(Request $request, array $params): void
    {
        if (DiscountTier::find((int) $params['id']) === null) {
            throw HttpException::notFound('El escalón no existe');
        }

        DiscountTier::delete((int) $params['id']);
        Response::noContent();
    }

    private function validateDiscountTier(Request $request): array
    {
        return Validator::make($request->body())
            ->int('minPages', 1, 100000)
            ->float('discountPercent', 0, 100)
            ->validated();
    }
}
