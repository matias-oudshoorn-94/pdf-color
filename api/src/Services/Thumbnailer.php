<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;

/**
 * Miniatura de la primera página de un PDF.
 * Requiere la extensión Imagick (con Ghostscript). Si el hosting no la tiene,
 * devuelve null y la miniatura la genera el navegador con PDF.js.
 */
final class Thumbnailer
{
    private const WIDTH = 520;

    public static function available(): bool
    {
        return extension_loaded('imagick');
    }

    public static function path(string $storedName): string
    {
        return self::directory() . '/' . pathinfo(basename($storedName), PATHINFO_FILENAME) . '.jpg';
    }

    public static function exists(string $storedName): bool
    {
        return is_file(self::path($storedName));
    }

    /** Genera la miniatura y devuelve su ruta, o null si no se pudo. */
    public static function generate(string $storedName, string $mime): ?string
    {
        if ($mime !== 'application/pdf' || !self::available()) {
            return null;
        }

        $source = Uploader::path($storedName);
        $target = self::path($storedName);

        if (!is_file($source)) {
            return null;
        }

        try {
            $imagick = new \Imagick();
            $imagick->setResolution(120, 120);
            $imagick->readImage($source . '[0]');
            $imagick->setImageBackgroundColor('white');
            $imagick = $imagick->flattenImages();
            $imagick->setImageFormat('jpeg');
            $imagick->setImageCompressionQuality(78);
            $imagick->thumbnailImage(self::WIDTH, 0);
            $imagick->writeImage($target);
            $imagick->clear();
        } catch (\Throwable) {
            return null;
        }

        return is_file($target) ? $target : null;
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
        $directory = dirname((string) Config::get('uploads.path')) . '/thumbs';

        if (!is_dir($directory)) {
            @mkdir($directory, 0755, true);
        }

        return rtrim($directory, '/');
    }
}
