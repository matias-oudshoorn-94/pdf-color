<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Career;
use App\Models\FileRecord;
use App\Models\Institution;
use App\Models\Rating;
use App\Models\Subject;
use App\Models\Year;
use App\Services\PageCounter;
use App\Services\Thumbnailer;
use App\Services\Uploader;

final class FileController
{
    public function index(Request $request): void
    {
        $params = Validator::make($request->query)
            ->string('search', 0, 120, required: false)
            ->int('page', 1, 10000, 1)
            ->int('limit', 1, 60, 24)
            ->enum('sort', array_keys(FileRecord::CATALOG_SORTABLE), 'created_at')
            ->enum('dir', ['asc', 'desc'], 'desc')
            ->validated();

        $level = $request->query('level');

        $filters = [
            'search' => $params['search'] ?? '',
            'locationId' => self::optionalId($request->query('locationId')),
            'institutionId' => self::optionalId($request->query('institutionId')),
            'level' => in_array($level, Year::LEVELS, true) ? $level : null,
            'careerId' => self::optionalId($request->query('careerId')),
            'yearId' => self::optionalId($request->query('yearId')),
            'subjectId' => self::optionalId($request->query('subjectId')),
        ];

        $offset = ($params['page'] - 1) * $params['limit'];
        $isAdmin = Auth::isAdmin();

        Response::json([
            'files' => FileRecord::visible(
                Auth::id(),
                $isAdmin,
                $filters,
                $params['limit'],
                $offset,
                $params['sort'],
                $params['dir'],
            ),
            'total' => FileRecord::countVisible(Auth::id(), $isAdmin, $filters),
            'page' => $params['page'],
            'limit' => $params['limit'],
        ]);
    }

    public function mine(Request $request): void
    {
        Response::json(['files' => FileRecord::byUser(Auth::id())]);
    }

    /** Clave de sesión con los archivos subidos como visitante, para asignarlos al iniciar sesión. */
    public const GUEST_SESSION_KEY = 'guest_file_ids';

    /**
     * Antes de subir: ¿el archivo ya está en el catálogo? Recibe la huella SHA-256 que
     * calcula el navegador (así no hace falta subirlo para saberlo), el nombre del
     * archivo y el título. Solo lee: la decisión de subirlo igual es del usuario.
     */
    public function duplicates(Request $request): void
    {
        RateLimiter::hit('file-duplicates', $request->ip(), 120, 3600);

        $hash = strtolower(trim((string) $request->query('hash', '')));
        $hash = preg_match('/^[a-f0-9]{64}$/', $hash) ? $hash : null;
        $fileName = mb_substr(trim((string) $request->query('fileName', '')), 0, 255);
        $title = mb_substr(trim((string) $request->query('title', '')), 0, 180);

        Response::json(['duplicates' => FileRecord::duplicates($hash, $fileName, $title)]);
    }

    public function store(Request $request): void
    {
        // Sin cuenta se puede subir (el login se pide en el checkout): además del
        // reCAPTCHA de la ruta, se limita la cantidad de subidas por IP.
        if (Auth::id() === null) {
            RateLimiter::hit('guest-upload', $request->ip(), 20, 3600);
        }

        $upload = $request->file('file');

        if ($upload === null) {
            throw HttpException::badRequest('Elegí un archivo para subir');
        }

        $data = Validator::make($request->body())
            ->string('title', 0, 180, required: false)
            ->string('description', 0, 500, required: false)
            ->validated();

        $institutionId = self::optionalId($request->input('institutionId'));
        $level = $request->input('level');
        $level = in_array($level, Year::LEVELS, true) ? $level : null;
        $careerId = self::optionalId($request->input('careerId'));
        $yearId = self::optionalId($request->input('yearId'));
        $subjectId = self::optionalId($request->input('subjectId'));

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

        $stored = Uploader::store($upload);
        $pageCount = PageCounter::count(Uploader::path($stored['stored_name']), $stored['mime_type']);

        $file = FileRecord::create([
            'user_id' => Auth::id(),
            'institution_id' => $institutionId,
            'level' => $level,
            'career_id' => $careerId,
            'year_id' => $yearId,
            'subject_id' => $subjectId,
            'title' => $data['title'] ?? $stored['original_name'],
            'description' => $data['description'],
            'original_name' => $stored['original_name'],
            'stored_name' => $stored['stored_name'],
            'mime_type' => $stored['mime_type'],
            'size_bytes' => $stored['size_bytes'],
            'content_hash' => $stored['content_hash'],
            'page_count' => $pageCount,
            // Todos los archivos subidos son públicos: el catálogo es el objetivo del sitio.
            'is_public' => 1,
        ]);

        if (Auth::id() === null) {
            $_SESSION[self::GUEST_SESSION_KEY][] = $file['id'];
        }

        Response::json(['file' => $file], 201);
    }

    public function download(Request $request, array $params): void
    {
        $file = $this->findAccessible((int) $params['id']);

        Response::download(Uploader::path($file['stored_name']), $file['original_name'], $file['mime_type']);
    }

    /** Vista previa dentro del sitio: solo formatos que el navegador puede mostrar. */
    public function preview(Request $request, array $params): void
    {
        $file = $this->findAccessible((int) $params['id']);

        if (!self::isPreviewable($file['mime_type'])) {
            throw HttpException::badRequest('Este tipo de archivo no se puede previsualizar');
        }

        Response::inline(Uploader::path($file['stored_name']), $file['original_name'], $file['mime_type']);
    }

    public static function isPreviewable(string $mime): bool
    {
        return $mime === 'application/pdf' || str_starts_with($mime, 'image/');
    }

    /** Miniatura de la primera página. 404 si el servidor no puede generarla. */
    public function thumb(Request $request, array $params): void
    {
        $file = $this->findAccessible((int) $params['id']);
        $path = Thumbnailer::exists($file['stored_name'])
            ? Thumbnailer::path($file['stored_name'])
            : Thumbnailer::generate($file['stored_name'], $file['mime_type']);

        if ($path === null) {
            throw HttpException::notFound('Sin miniatura');
        }

        Response::inline($path, 'miniatura.jpg', 'image/jpeg');
    }

    public function destroy(Request $request, array $params): void
    {
        $file = FileRecord::find((int) $params['id']);

        if ($file === null) {
            throw HttpException::notFound('El archivo no existe');
        }

        if ((int) $file['user_id'] !== Auth::id() && !Auth::isAdmin()) {
            throw HttpException::forbidden();
        }

        if (FileRecord::isUsedInOrders($file['id'])) {
            throw HttpException::badRequest('No se puede borrar: el archivo forma parte de un pedido');
        }

        FileRecord::delete($file['id']);
        Uploader::remove($file['stored_name']);
        Thumbnailer::remove($file['stored_name']);

        Response::noContent();
    }

    /** Valoración propia + promedio del archivo. */
    public function rating(Request $request, array $params): void
    {
        $file = $this->findAccessible((int) $params['id']);

        Response::json([
            'rating' => [
                ...Rating::summary($file['id']),
                'mine' => Auth::id() === null ? null : Rating::forUser($file['id'], Auth::id()),
            ],
        ]);
    }

    /** Puntuar (o repuntuar) un archivo de 1 a 5 estrellas. Se guarda al instante. */
    public function rate(Request $request, array $params): void
    {
        $file = $this->findAccessible((int) $params['id']);

        $data = Validator::make($request->body())
            ->int('rating', 1, 5)
            ->validated();

        Rating::upsert($file['id'], Auth::id(), $data['rating']);

        Response::json([
            'rating' => [
                ...Rating::summary($file['id']),
                'mine' => $data['rating'],
            ],
        ]);
    }

    private function findAccessible(int $id): array
    {
        $file = FileRecord::find($id);

        if ($file === null) {
            throw HttpException::notFound('El archivo no existe');
        }

        if (!$file['is_public'] && (int) $file['user_id'] !== Auth::id() && !Auth::isAdmin()) {
            throw HttpException::forbidden();
        }

        return $file;
    }

    private static function optionalId(mixed $value): ?int
    {
        return $value === null || $value === '' || $value === '0' ? null : (int) $value;
    }
}
