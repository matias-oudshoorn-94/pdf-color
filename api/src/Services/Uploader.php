<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\HttpException;

/** Guarda los archivos subidos fuera del docroot, con nombre aleatorio y MIME verificado. */
final class Uploader
{
    public static function store(array $file): array
    {
        self::assertNoError($file['error']);

        if (!is_uploaded_file($file['tmp_name'])) {
            throw HttpException::badRequest('La subida no es válida');
        }

        $maxBytes = (int) Config::get('uploads.max_bytes');

        if ($file['size'] <= 0 || $file['size'] > $maxBytes) {
            throw HttpException::badRequest(
                'El archivo supera el máximo de ' . round($maxBytes / 1048576) . ' MB',
            );
        }

        // El MIME real se detecta del contenido, nunca se confía en el que envía el navegador.
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
        $allowed = Config::get('uploads.allowed');

        if (!isset($allowed[$mime])) {
            throw HttpException::badRequest('Solo se permiten archivos PDF');
        }

        if ($mime === 'application/pdf' && PageCounter::isPasswordProtected($file['tmp_name'])) {
            throw HttpException::badRequest(
                'El PDF está protegido con contraseña. Subí una versión sin contraseña para poder imprimirlo.',
            );
        }

        $directory = self::directory();
        $storedName = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];

        if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $storedName)) {
            throw new HttpException(500, 'No se pudo guardar el archivo');
        }

        chmod($directory . '/' . $storedName, 0644);

        return [
            'stored_name' => $storedName,
            'original_name' => mb_substr(basename((string) $file['name']), 0, 255),
            'mime_type' => $mime,
            'size_bytes' => (int) $file['size'],
            // Huella del contenido: detecta el mismo archivo subido de nuevo con otro nombre.
            'content_hash' => hash_file('sha256', $directory . '/' . $storedName) ?: null,
        ];
    }

    public static function path(string $storedName): string
    {
        return self::directory() . '/' . basename($storedName);
    }

    public static function remove(string $storedName): void
    {
        $path = self::path($storedName);

        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function directory(): string
    {
        $directory = (string) Config::get('uploads.path');

        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new HttpException(500, 'No se pudo crear la carpeta de archivos');
        }

        if (!is_writable($directory)) {
            throw new HttpException(500, 'La carpeta de archivos no tiene permisos de escritura');
        }

        return rtrim($directory, '/');
    }

    private static function assertNoError(int $code): void
    {
        $message = match ($code) {
            UPLOAD_ERR_OK => null,
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'El archivo es demasiado grande',
            UPLOAD_ERR_PARTIAL => 'La subida se interrumpió, probá de nuevo',
            UPLOAD_ERR_NO_FILE => 'No se recibió ningún archivo',
            default => 'No se pudo procesar la subida',
        };

        if ($message !== null) {
            throw HttpException::badRequest($message);
        }
    }
}
