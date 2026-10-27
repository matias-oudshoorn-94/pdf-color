<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/** Valoración de 1 a 5 estrellas por archivo. Un usuario, un voto por archivo (actualizable). */
final class Rating
{
    public static function upsert(int $fileId, int $userId, int $rating): void
    {
        Database::execute(
            'INSERT INTO file_ratings (file_id, user_id, rating) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating)',
            [$fileId, $userId, $rating],
        );
    }

    public static function forUser(int $fileId, int $userId): ?int
    {
        $row = Database::selectOne(
            'SELECT rating FROM file_ratings WHERE file_id = ? AND user_id = ?',
            [$fileId, $userId],
        );

        return $row !== null ? (int) $row['rating'] : null;
    }

    /** @return array{average: float, count: int} */
    public static function summary(int $fileId): array
    {
        $row = Database::selectOne(
            'SELECT ROUND(AVG(rating), 2) AS average, COUNT(*) AS count FROM file_ratings WHERE file_id = ?',
            [$fileId],
        );

        return [
            'average' => $row !== null && $row['average'] !== null ? (float) $row['average'] : 0.0,
            'count' => $row !== null ? (int) $row['count'] : 0,
        ];
    }
}
