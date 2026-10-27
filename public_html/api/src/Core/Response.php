<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function noContent(): void
    {
        http_response_code(204);
    }

    /** Envía un archivo del storage sin exponer su ruta real. */
    public static function download(string $absolutePath, string $downloadName, string $mime): void
    {
        if (!is_file($absolutePath)) {
            throw HttpException::notFound('El archivo ya no está disponible');
        }

        $safeName = preg_replace('/[^\w .\-()]+/u', '_', $downloadName) ?: 'archivo';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($absolutePath));
        header('Content-Disposition: attachment; filename="' . $safeName . '"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=0, must-revalidate');

        readfile($absolutePath);
    }

    /** Igual que download() pero para mostrar el archivo dentro del sitio. */
    public static function inline(string $absolutePath, string $downloadName, string $mime): void
    {
        if (!is_file($absolutePath)) {
            throw HttpException::notFound('El archivo ya no está disponible');
        }

        $safeName = preg_replace('/[^\w .\-()]+/u', '_', $downloadName) ?: 'archivo';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($absolutePath));
        header('Content-Disposition: inline; filename="' . $safeName . '"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=0, must-revalidate');
        // El visor lo embebe en un iframe del propio sitio.
        header('X-Frame-Options: SAMEORIGIN');
        header("Content-Security-Policy: frame-ancestors 'self'");

        readfile($absolutePath);
    }
}
