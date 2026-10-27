<?php

declare(strict_types=1);

namespace App\Core;

/** Error con código HTTP, capturado por el front controller. */
class HttpException extends \RuntimeException
{
    public function __construct(
        private readonly int $status,
        string $message,
        private readonly array $details = [],
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $status, $previous);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function details(): array
    {
        return $this->details;
    }

    public static function badRequest(string $message = 'Datos inválidos', array $details = []): self
    {
        return new self(400, $message, $details);
    }

    public static function unauthorized(string $message = 'Necesitás iniciar sesión'): self
    {
        return new self(401, $message);
    }

    public static function forbidden(string $message = 'No tenés permisos para esta acción'): self
    {
        return new self(403, $message);
    }

    public static function notFound(string $message = 'Recurso no encontrado'): self
    {
        return new self(404, $message);
    }

    public static function tooMany(string $message = 'Demasiados intentos, probá más tarde'): self
    {
        return new self(429, $message);
    }
}
