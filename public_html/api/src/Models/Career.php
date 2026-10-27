<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

/** Carreras universitarias: lista global, igual que Subject, independiente de la institución. */
final class Career
{
    public const SORTABLE = [
        'name' => 'name',
        'files_count' => 'files_count',
        'created_at' => 'created_at',
    ];

    public static function all(string $search = '', ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search);

        $sql = "SELECT ca.id, ca.name, ca.created_by_user, ca.created_at,
                       (SELECT COUNT(*) FROM files f WHERE f.career_id = ca.id) AS files_count
                FROM careers ca {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY ca.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = ''): int
    {
        [$where, $params] = self::filters($search);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM careers ca {$where}", $params)['total'];
    }

    private static function filters(string $search): array
    {
        if ($search === '') {
            return ['', []];
        }

        return ['WHERE ca.name LIKE :search', ['search' => '%' . $search . '%']];
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM careers WHERE id = ?', [$id]);
    }

    public static function create(string $name, bool $byUser = false): array
    {
        return self::find(Database::insert('INSERT INTO careers (name, created_by_user) VALUES (?, ?)', [$name, (int) $byUser]));
    }

    public static function update(int $id, string $name): ?array
    {
        Database::execute('UPDATE careers SET name = ? WHERE id = ?', [$name, $id]);

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM careers WHERE id = ?', [$id]);
    }

    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM careers WHERE name = ? AND id <> ? LIMIT 1',
            [$name, $exceptId ?? 0],
        ) !== null;
    }
}
