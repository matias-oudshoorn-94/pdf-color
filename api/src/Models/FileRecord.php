<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Services\Similarity;
use App\Services\Uploader;

final class FileRecord
{
    public const SORTABLE = [
        'title' => 'f.title',
        'owner_name' => 'u.name',
        'institution_name' => 'i.name',
        'size_bytes' => 'f.size_bytes',
        'is_public' => 'f.is_public',
        'sales_count' => 'sales_count',
        'created_at' => 'f.created_at',
    ];

    /** Ordenamientos permitidos en el catálogo público. */
    public const CATALOG_SORTABLE = [
        'created_at' => 'f.created_at',
        'sales_count' => 'sales_count',
        'price' => 'estimated_price',
    ];

    /** Institución, nivel, carrera, año y materia son cinco ejes independientes del archivo. */
    private const SELECT = 'SELECT f.id, f.user_id, f.institution_id, f.level, f.career_id, f.year_id, f.subject_id,
                                   f.title, f.description, f.original_name,
                                   f.stored_name, f.mime_type, f.size_bytes, f.page_count, f.is_public, f.created_at,
                                   COALESCE(u.name, \'Invitado\') AS owner_name,
                                   y.name AS year_name,
                                   ca.name AS career_name,
                                   s.name AS subject_name,
                                   i.name AS institution_name,
                                   l.id AS location_id, l.name AS location_name,
                                   (SELECT COALESCE(SUM(oi.copies), 0)
                                    FROM order_items oi
                                    JOIN orders o ON o.id = oi.order_id
                                    WHERE oi.file_id = f.id AND o.status <> \'cancelado\') AS sales_count,
                                   ROUND(f.page_count * (SELECT price_per_sheet FROM settings WHERE id = 1), 2) AS estimated_price,
                                   (SELECT COALESCE(ROUND(AVG(r.rating), 2), 0) FROM file_ratings r WHERE r.file_id = f.id) AS avg_rating,
                                   (SELECT COUNT(*) FROM file_ratings r WHERE r.file_id = f.id) AS ratings_count
                            FROM files f
                            LEFT JOIN users u ON u.id = f.user_id
                            LEFT JOIN institutions i ON i.id = f.institution_id
                            LEFT JOIN locations l ON l.id = i.location_id
                            LEFT JOIN careers ca ON ca.id = f.career_id
                            LEFT JOIN years y ON y.id = f.year_id
                            LEFT JOIN subjects s ON s.id = f.subject_id';

    public static function find(int $id): ?array
    {
        return Database::selectOne(self::SELECT . ' WHERE f.id = ?', [$id]);
    }

    /** Catálogo: públicos + propios (el admin ve todo), con filtros y orden opcionales. */
    public static function visible(
        ?int $userId,
        bool $isAdmin,
        array $filters,
        int $limit,
        int $offset,
        string $sort = 'created_at',
        string $dir = 'desc',
    ): array {
        [$where, $params] = self::buildFilters($userId, $isAdmin, $filters);

        $orderColumn = self::CATALOG_SORTABLE[$sort] ?? self::CATALOG_SORTABLE['created_at'];
        $orderDir = strtoupper($dir) === 'ASC' ? 'ASC' : 'DESC';

        return Database::select(
            self::SELECT . " WHERE {$where} ORDER BY {$orderColumn} {$orderDir}, f.id DESC LIMIT {$limit} OFFSET {$offset}",
            $params,
        );
    }

    public static function countVisible(?int $userId, bool $isAdmin, array $filters): int
    {
        [$where, $params] = self::buildFilters($userId, $isAdmin, $filters);

        return (int) Database::selectOne(
            "SELECT COUNT(*) AS total
             FROM files f
             LEFT JOIN institutions i ON i.id = f.institution_id
             LEFT JOIN subjects s ON s.id = f.subject_id
             WHERE {$where}",
            $params,
        )['total'];
    }

    public static function byUser(int $userId): array
    {
        return Database::select(self::SELECT . ' WHERE f.user_id = ? ORDER BY f.created_at DESC', [$userId]);
    }

    public static function create(array $data): array
    {
        $id = Database::insert(
            'INSERT INTO files (user_id, institution_id, level, career_id, year_id, subject_id, title, description, original_name, stored_name, mime_type, size_bytes, content_hash, page_count, is_public)
             VALUES (:user_id, :institution_id, :level, :career_id, :year_id, :subject_id, :title, :description, :original_name, :stored_name, :mime_type, :size_bytes, :content_hash, :page_count, :is_public)',
            $data,
        );

        return self::find($id);
    }

    /**
     * Archivos del catálogo que podrían ser el que el usuario está por subir:
     *  - same_file: mismo contenido (misma huella SHA-256), aunque tenga otro nombre;
     *  - similar_name: título parecido o mismo nombre de archivo.
     * Como mucho $limit en total, primero los de mismo contenido.
     *
     * @return list<array<string, mixed>> filas del catálogo + 'match' ('same_file' | 'similar_name')
     */
    public static function duplicates(?string $hash, string $fileName, string $title, int $limit = 4): array
    {
        self::backfillHashes();

        $found = [];

        if ($hash !== null) {
            foreach (Database::select(self::SELECT . ' WHERE f.is_public = 1 AND f.content_hash = ? ORDER BY f.created_at DESC LIMIT ' . $limit, [$hash]) as $row) {
                $found[$row['id']] = $row + ['match' => 'same_file'];
            }
        }

        // El nombre del archivo solo cuenta si coincide del todo: "apunte.pdf" o
        // "scan 001.pdf" se repiten entre archivos distintos.
        $baseName = (string) preg_replace('/\.[a-z0-9]{2,5}$/i', '', $fileName);
        $scores = [];

        foreach (Database::select('SELECT id, title, original_name FROM files WHERE is_public = 1') as $candidate) {
            if (isset($found[$candidate['id']])) {
                continue;
            }

            $byTitle = $title !== '' ? Similarity::score($title, (string) $candidate['title']) : 0.0;
            $candidateBase = (string) preg_replace('/\.[a-z0-9]{2,5}$/i', '', (string) $candidate['original_name']);
            $byName = $baseName !== '' && Similarity::score($baseName, $candidateBase) >= 1.0 ? 1.0 : 0.0;
            $score = max($byTitle, $byName);

            if ($score >= Similarity::THRESHOLD) {
                $scores[$candidate['id']] = $score;
            }
        }

        arsort($scores);

        foreach (array_slice(array_keys($scores), 0, max(0, $limit - count($found))) as $id) {
            $found[$id] = self::find((int) $id) + ['match' => 'similar_name'];
        }

        return array_values(array_slice($found, 0, $limit));
    }

    /**
     * Completa la huella de los archivos subidos antes de que existiera, de a pocos
     * por llamada para no demorar la respuesta (con muchos archivos se termina en
     * unas pocas subidas).
     */
    private static function backfillHashes(int $max = 20, float $seconds = 2.0): void
    {
        $started = microtime(true);
        $pending = Database::select('SELECT id, stored_name FROM files WHERE content_hash IS NULL LIMIT ' . $max);

        foreach ($pending as $file) {
            $path = Uploader::path($file['stored_name']);
            $hash = is_file($path) ? hash_file('sha256', $path) : false;

            // Si el archivo no está en disco se marca igual, para no reintentarlo siempre.
            Database::execute('UPDATE files SET content_hash = ? WHERE id = ?', [$hash ?: str_repeat('0', 64), $file['id']]);

            if (microtime(true) - $started > $seconds) {
                break;
            }
        }
    }

    /**
     * Asigna al usuario los archivos que subió como visitante (todavía sin dueño).
     *
     * @param int[] $ids
     */
    public static function claim(array $ids, int $userId): void
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));

        if ($ids === []) {
            return;
        }

        $placeholders = implode(', ', array_fill(0, count($ids), '?'));

        Database::execute(
            "UPDATE files SET user_id = ? WHERE user_id IS NULL AND id IN ({$placeholders})",
            [$userId, ...$ids],
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM files WHERE id = ?', [$id]);
    }

    /** Listado completo para el panel. */
    public static function all(string $search = '', ?\App\Core\Paginator $page = null): array
    {
        [$where, $params] = self::adminFilters($search);

        $sql = self::SELECT . " {$where} ";
        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY f.created_at DESC';

        return Database::select($sql, $params);
    }

    public static function countAll(string $search = ''): int
    {
        [$where, $params] = self::adminFilters($search);

        return (int) Database::selectOne(
            "SELECT COUNT(*) AS total
             FROM files f
             LEFT JOIN users u ON u.id = f.user_id
             LEFT JOIN institutions i ON i.id = f.institution_id
             LEFT JOIN subjects s ON s.id = f.subject_id {$where}",
            $params,
        )['total'];
    }

    private static function adminFilters(string $search): array
    {
        if ($search === '') {
            return ['', []];
        }

        return [
            'WHERE f.title LIKE :s1 OR f.original_name LIKE :s2
             OR u.name LIKE :s3 OR i.name LIKE :s4 OR s.name LIKE :s5',
            array_fill_keys(['s1', 's2', 's3', 's4', 's5'], '%' . $search . '%'),
        ];
    }

    public static function update(int $id, array $fields): ?array
    {
        Database::execute(
            'UPDATE files SET title = :title, description = :description, is_public = :is_public,
                               institution_id = :institution_id, level = :level, career_id = :career_id,
                               year_id = :year_id, subject_id = :subject_id, page_count = :page_count
             WHERE id = :id',
            [
                'id' => $id,
                'title' => $fields['title'],
                'description' => $fields['description'],
                'is_public' => (int) $fields['is_public'],
                'institution_id' => $fields['institution_id'],
                'level' => $fields['level'],
                'career_id' => $fields['career_id'],
                'year_id' => $fields['year_id'],
                'subject_id' => $fields['subject_id'],
                'page_count' => $fields['page_count'],
            ],
        );

        return self::find($id);
    }

    public static function isUsedInOrders(int $id): bool
    {
        return Database::selectOne('SELECT 1 FROM order_items WHERE file_id = ? LIMIT 1', [$id]) !== null;
    }

    /** @return array{0: string, 1: array} condición SQL y parámetros */
    private static function buildFilters(?int $userId, bool $isAdmin, array $filters): array
    {
        $conditions = [];
        $params = [];

        if ($isAdmin) {
            $conditions[] = '1 = 1';
        } elseif ($userId === null) {
            $conditions[] = 'f.is_public = 1';
        } else {
            $conditions[] = '(f.is_public = 1 OR f.user_id = :user_id)';
            $params['user_id'] = $userId;
        }

        if (($filters['search'] ?? '') !== '') {
            $conditions[] = '(f.title LIKE :s1 OR f.description LIKE :s2 OR s.name LIKE :s3)';
            $params['s1'] = $params['s2'] = $params['s3'] = '%' . $filters['search'] . '%';
        }

        if (!empty($filters['yearId'])) {
            $conditions[] = 'f.year_id = :year_id';
            $params['year_id'] = $filters['yearId'];
        }

        if (!empty($filters['subjectId'])) {
            $conditions[] = 'f.subject_id = :subject_id';
            $params['subject_id'] = $filters['subjectId'];
        }

        if (!empty($filters['institutionId'])) {
            $conditions[] = 'f.institution_id = :institution_id';
            $params['institution_id'] = $filters['institutionId'];
        }

        if (!empty($filters['level'])) {
            $conditions[] = 'f.level = :level';
            $params['level'] = $filters['level'];
        }

        if (!empty($filters['careerId'])) {
            $conditions[] = 'f.career_id = :career_id';
            $params['career_id'] = $filters['careerId'];
        }

        if (!empty($filters['locationId'])) {
            $conditions[] = 'i.location_id = :location_id';
            $params['location_id'] = $filters['locationId'];
        }

        return [implode(' AND ', $conditions), $params];
    }
}
