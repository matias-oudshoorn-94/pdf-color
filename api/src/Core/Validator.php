<?php

declare(strict_types=1);

namespace App\Core;

/** Validación declarativa: devuelve los datos ya saneados o lanza un 400 con los errores por campo. */
final class Validator
{
    private array $errors = [];
    private array $clean = [];

    public function __construct(private readonly array $data)
    {
    }

    public static function make(array $data): self
    {
        return new self($data);
    }

    public function string(string $field, int $min = 0, int $max = 255, bool $required = true): self
    {
        $value = trim((string) ($this->data[$field] ?? ''));

        if ($value === '') {
            if ($required) {
                $this->errors[$field][] = 'Este campo es obligatorio';
            } else {
                $this->clean[$field] = null;
            }

            return $this;
        }

        $length = mb_strlen($value);

        if ($length < $min) {
            $this->errors[$field][] = "Debe tener al menos {$min} caracteres";
        } elseif ($length > $max) {
            $this->errors[$field][] = "No puede superar los {$max} caracteres";
        } else {
            $this->clean[$field] = $value;
        }

        return $this;
    }

    public function email(string $field): self
    {
        $value = mb_strtolower(trim((string) ($this->data[$field] ?? '')));
        $filtered = filter_var($value, FILTER_VALIDATE_EMAIL);

        if ($filtered === false || mb_strlen($value) > 180) {
            $this->errors[$field][] = 'Ingresá un email válido';
        } else {
            $this->clean[$field] = $filtered;
        }

        return $this;
    }

    public function password(string $field, int $min = 8): self
    {
        $value = (string) ($this->data[$field] ?? '');

        if (strlen($value) < $min) {
            $this->errors[$field][] = "La contraseña debe tener al menos {$min} caracteres";
        } elseif (strlen($value) > 200) {
            $this->errors[$field][] = 'La contraseña es demasiado larga';
        } else {
            $this->clean[$field] = $value;
        }

        return $this;
    }

    public function int(string $field, int $min, int $max, ?int $default = null): self
    {
        $raw = $this->data[$field] ?? $default;

        if ($raw === null || $raw === '') {
            $this->errors[$field][] = 'Este campo es obligatorio';

            return $this;
        }

        $value = filter_var($raw, FILTER_VALIDATE_INT);

        if ($value === false || $value < $min || $value > $max) {
            $this->errors[$field][] = "Debe ser un número entre {$min} y {$max}";
        } else {
            $this->clean[$field] = $value;
        }

        return $this;
    }

    public function float(string $field, float $min, float $max, ?float $default = null): self
    {
        $raw = $this->data[$field] ?? $default;

        if ($raw === null || $raw === '') {
            $this->errors[$field][] = 'Este campo es obligatorio';

            return $this;
        }

        $value = filter_var($raw, FILTER_VALIDATE_FLOAT);

        if ($value === false || $value < $min || $value > $max) {
            $this->errors[$field][] = "Debe ser un número entre {$min} y {$max}";
        } else {
            $this->clean[$field] = $value;
        }

        return $this;
    }

    public function enum(string $field, array $allowed, ?string $default = null): self
    {
        $value = (string) ($this->data[$field] ?? $default ?? '');

        if (!in_array($value, $allowed, true)) {
            $this->errors[$field][] = 'Valor no permitido';
        } else {
            $this->clean[$field] = $value;
        }

        return $this;
    }

    public function bool(string $field): self
    {
        $value = $this->data[$field] ?? false;
        $this->clean[$field] = in_array($value, [true, 1, '1', 'true', 'on'], true);

        return $this;
    }

    public function validated(): array
    {
        if ($this->errors !== []) {
            throw HttpException::badRequest('Revisá los datos del formulario', $this->errors);
        }

        return $this->clean;
    }
}
