<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;

/**
 * Cliente SMTP mínimo (sin librerías externas: el proyecto no usa composer).
 * Pensado para un buzón normal (ej: Hostinger) con AUTH LOGIN y SSL/STARTTLS.
 */
final class Mailer
{
    private const TIMEOUT = 10;

    /** Manda un mail HTML. Nunca tira excepción: devuelve false y loguea si algo falla. */
    public static function send(string $to, string $subject, string $html): bool
    {
        $host = (string) Config::get('mail.host');
        $username = (string) Config::get('mail.username');
        $password = (string) Config::get('mail.password');

        if ($host === '' || $username === '') {
            error_log('[mailer] falta configuración SMTP (mail.host / mail.username)');

            return false;
        }

        $port = (int) Config::get('mail.port', 465);
        $encryption = (string) Config::get('mail.encryption', 'ssl');
        $fromAddress = (string) Config::get('mail.from_address', $username) ?: $username;
        $fromName = (string) Config::get('mail.from_name', 'PDF Color');

        $stream = null;

        try {
            $transport = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
            $stream = @stream_socket_client(
                $transport . $host . ':' . $port,
                $errno,
                $errstr,
                self::TIMEOUT,
                STREAM_CLIENT_CONNECT,
            );

            if ($stream === false) {
                throw new \RuntimeException("no se pudo conectar a {$host}:{$port} ({$errstr})");
            }

            stream_set_timeout($stream, self::TIMEOUT);

            self::expect($stream, 220);
            self::command($stream, 'EHLO ' . self::ehloHost(), 250);

            if ($encryption === 'tls') {
                self::command($stream, 'STARTTLS', 220);

                if (!stream_socket_enable_crypto($stream, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new \RuntimeException('no se pudo habilitar STARTTLS');
                }

                self::command($stream, 'EHLO ' . self::ehloHost(), 250);
            }

            self::command($stream, 'AUTH LOGIN', 334);
            self::command($stream, base64_encode($username), 334);
            self::command($stream, base64_encode($password), 235);

            self::command($stream, 'MAIL FROM:<' . $fromAddress . '>', 250);
            self::command($stream, 'RCPT TO:<' . $to . '>', 250);
            self::command($stream, 'DATA', 354);

            $message = self::buildMessage($fromAddress, $fromName, $to, $subject, $html);
            self::write($stream, $message . "\r\n.");
            self::expect($stream, 250);

            self::command($stream, 'QUIT', 221);

            return true;
        } catch (\Throwable $e) {
            error_log('[mailer] ' . $e->getMessage());

            return false;
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    private static function ehloHost(): string
    {
        return parse_url(Config::appUrl(), PHP_URL_HOST) ?: 'localhost';
    }

    private static function buildMessage(
        string $fromAddress,
        string $fromName,
        string $to,
        string $subject,
        string $html,
    ): string {
        $headers = [
            'From' => self::encodeHeader($fromName) . ' <' . $fromAddress . '>',
            'To' => $to,
            'Subject' => self::encodeHeader($subject),
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/html; charset=UTF-8',
            // Base64 evita problemas de "dot-stuffing" (una línea que empiece con
            // "." se puede confundir con el fin de los datos del comando DATA).
            'Content-Transfer-Encoding' => 'base64',
            'Date' => date('r'),
        ];

        $lines = [];

        foreach ($headers as $name => $value) {
            $lines[] = "{$name}: {$value}";
        }

        $lines[] = '';
        $lines[] = chunk_split(base64_encode($html));

        return implode("\r\n", $lines);
    }

    private static function encodeHeader(string $value): string
    {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private static function command($stream, string $line, int $expectedCode): void
    {
        self::write($stream, $line);
        self::expect($stream, $expectedCode);
    }

    private static function write($stream, string $line): void
    {
        fwrite($stream, $line . "\r\n");
    }

    /** Lee una respuesta SMTP (puede ser multilínea) y valida el código esperado. */
    private static function expect($stream, int $expectedCode): string
    {
        $lastLine = '';

        do {
            $line = fgets($stream, 515);

            if ($line === false) {
                throw new \RuntimeException('el servidor SMTP cerró la conexión inesperadamente');
            }

            $lastLine = $line;
        } while (isset($line[3]) && $line[3] === '-');

        $code = (int) substr($lastLine, 0, 3);

        if ($code !== $expectedCode) {
            throw new \RuntimeException("respuesta SMTP inesperada: {$lastLine}");
        }

        return $lastLine;
    }
}
