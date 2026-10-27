<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class User
{
    public const SORTABLE = [
        'name' => 'u.name',
        'email' => 'u.email',
        'files_count' => 'files_count',
        'orders_count' => 'orders_count',
        'created_at' => 'u.created_at',
    ];

    private const PUBLIC_FIELDS = 'id, name, email, role, phone, created_at';

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT ' . self::PUBLIC_FIELDS . ' FROM users WHERE id = ?', [$id]);
    }

    /** Incluye el hash: usar sólo para verificar credenciales. */
    public static function findByEmailWithHash(string $email): ?array
    {
        return Database::selectOne(
            'SELECT id, name, email, role, phone, password_hash FROM users WHERE email = ?',
            [$email],
        );
    }

    public static function emailExists(string $email): bool
    {
        return Database::selectOne('SELECT 1 FROM users WHERE email = ?', [$email]) !== null;
    }

    public static function findByEmail(string $email): ?array
    {
        return Database::selectOne('SELECT ' . self::PUBLIC_FIELDS . ' FROM users WHERE email = ?', [$email]);
    }

    public static function create(string $name, string $email, string $password, ?string $phone): array
    {
        $id = Database::insert(
            'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
            [$name, $email, password_hash($password, PASSWORD_DEFAULT), $phone],
        );

        return self::find($id);
    }

    public static function verifyPassword(array $user, string $password): bool
    {
        if (!password_verify($password, $user['password_hash'])) {
            return false;
        }

        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [
                password_hash($password, PASSWORD_DEFAULT),
                $user['id'],
            ]);
        }

        return true;
    }

    /** Listado para el panel, con contadores de actividad. Filtrable por rol. */
    public static function all(string $search = '', string $role = '', ?\App\Core\Paginator $page = null): array
    {
        [$where, $params] = self::filters($search, $role);

        $sql = "SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
                       (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id) AS files_count,
                       (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count
                FROM users u {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY u.created_at DESC';

        return Database::select($sql, $params);
    }

    public static function count(string $search = '', string $role = ''): int
    {
        [$where, $params] = self::filters($search, $role);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM users u {$where}", $params)['total'];
    }

    private static function filters(string $search, string $role): array
    {
        $conditions = [];
        $params = [];

        if ($role !== '') {
            $conditions[] = 'u.role = :role';
            $params['role'] = $role;
        }

        if ($search !== '') {
            $conditions[] = '(u.name LIKE :s1 OR u.email LIKE :s2)';
            $params['s1'] = $params['s2'] = '%' . $search . '%';
        }

        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    public static function createWithRole(string $name, string $email, string $password, ?string $phone, string $role): array
    {
        $id = Database::insert(
            'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
            [$name, $email, password_hash($password, PASSWORD_DEFAULT), $phone, $role],
        );

        return self::find($id);
    }

    public static function update(int $id, array $fields): ?array
    {
        $allowed = ['name', 'email', 'phone', 'role'];
        $sets = [];
        $params = ['id' => $id];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $fields)) {
                $sets[] = "{$field} = :{$field}";
                $params[$field] = $fields[$field];
            }
        }

        if (!empty($fields['password'])) {
            $sets[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($fields['password'], PASSWORD_DEFAULT);
        }

        if ($sets !== []) {
            Database::execute('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
        }

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM users WHERE id = ?', [$id]);
    }

    public static function countAdmins(): int
    {
        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")['total'];
    }
}
