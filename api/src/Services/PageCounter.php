<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Cuenta las hojas (páginas) de un archivo para calcular el precio automáticamente.
 * Los PDF se miden con Imagick/Ghostscript si están disponibles, o si no con una
 * lectura directa del archivo. El resto de los formatos (imágenes, Word) cuenta como 1 hoja.
 */
final class PageCounter
{
    public static function count(string $path, string $mime): int
    {
        if ($mime !== 'application/pdf' || !is_file($path)) {
            return 1;
        }

        $pages = self::withImagick($path) ?? self::withRawScan($path);

        return $pages !== null && $pages > 0 ? $pages : 1;
    }

    /** El PDF tiene un diccionario /Encrypt en su estructura: pide contraseña para abrirse. */
    public static function isPasswordProtected(string $path): bool
    {
        $content = @file_get_contents($path);

        return $content !== false && preg_match('/\/Encrypt\s+\d+\s+\d+\s+R/', $content) === 1;
    }

    private static function withImagick(string $path): ?int
    {
        if (!extension_loaded('imagick')) {
            return null;
        }

        try {
            $imagick = new \Imagick();
            $imagick->pingImage($path);
            $count = $imagick->getNumberImages();
            $imagick->clear();

            return $count > 0 ? $count : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** Sin Imagick: busca el /Count del árbol /Pages y cuenta objetos /Type /Page. */
    private static function withRawScan(string $path): ?int
    {
        $content = @file_get_contents($path);

        if ($content === false) {
            return null;
        }

        $candidates = [];

        if (preg_match_all('/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/s', $content, $matches)) {
            $candidates = array_map('intval', $matches[1]);
        }

        $typePageCount = preg_match_all('/\/Type\s*\/Page(?!s)\b/', $content);

        if ($typePageCount) {
            $candidates[] = $typePageCount;
        }

        return $candidates === [] ? null : max($candidates);
    }
}
