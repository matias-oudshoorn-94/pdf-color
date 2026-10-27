<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

/** Materias: lista global, independiente del curso (año/división) e institución. */
final class Subject
{
    public const SORTABLE = [
        'name' => 'name',
        'files_count' => 'files_count',
        'created_at' => 'created_at',
    ];

    public static function all(string $search = '', ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search);

        $sql = "SELECT s.id, s.name, s.created_by_user, s.created_at,
                       (SELECT COUNT(*) FROM files f WHERE f.subject_id = s.id) AS files_count
                FROM subjects s {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY s.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = ''): int
    {
        [$where, $params] = self::filters($search);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM subjects s {$where}", $params)['total'];
    }

    private static function filters(string $search): array
    {
        if ($search === '') {
            return ['', []];
        }

        return ['WHERE s.name LIKE :search', ['search' => '%' . $search . '%']];
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM subjects WHERE id = ?', [$id]);
    }

    public static function create(string $name, bool $byUser = false): array
    {
        return self::find(Database::insert('INSERT INTO subjects (name, created_by_user) VALUES (?, ?)', [$name, (int) $byUser]));
    }

    public static function update(int $id, string $name): ?array
    {
        Database::execute('UPDATE subjects SET name = ? WHERE id = ?', [$name, $id]);

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM subjects WHERE id = ?', [$id]);
    }

    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM subjects WHERE name = ? AND id <> ? LIMIT 1',
            [$name, $exceptId ?? 0],
        ) !== null;
    }
}
