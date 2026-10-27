<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;

/**
 * Los mails que manda el sitio. Cada método arma el contenido y lo envuelve en
 * el mismo layout (logo, tarjeta blanca sobre fondo gris, pie con los datos de
 * contacto). Todo con tablas y estilos inline: es lo único que los clientes de
 * correo (Gmail, Outlook) respetan de forma pareja.
 */
final class Emails
{
    private const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

    private const FINISH_LABELS = [
        'simple' => 'Suelto',
        'anillado' => 'Anillado',
        'engrapado' => 'Engrapado',
        'encuadernado' => 'Encuadernado',
    ];

    private const PAYMENT_METHOD_LABELS = ['efectivo' => 'Efectivo', 'mercadopago' => 'Mercado Pago'];

    private const PAYMENT_STATUS_LABELS = [
        'pendiente' => 'Pendiente',
        'aprobado' => 'Aprobado',
        'rechazado' => 'Rechazado',
        'approved' => 'Aprobado',
        'pending' => 'Pendiente',
        'in_process' => 'En proceso',
        'rejected' => 'Rechazado',
    ];

    // ---------- Mails ----------

    public static function welcome(array $user): bool
    {
        $content = self::heading('¡Bienvenido a PDF Color!')
            . self::paragraph('Hola ' . self::e($user['name']) . ', tu cuenta ya está creada.')
            . self::paragraph('Desde ahora podés subir tus archivos, armar tu pedido de impresión y seguir su estado desde la web.')
            . self::dataTable(['Email de ingreso' => self::e($user['email'])])
            . self::button('Hacer mi primer pedido', Config::appUrl())
            . self::note('Si no creaste esta cuenta, respondé este mail y lo revisamos.');

        return Mailer::send(
            $user['email'],
            '¡Bienvenido a PDF Color!',
            self::layout($content, 'Tu cuenta ya está creada. Ya podés hacer tu primer pedido.'),
        );
    }

    public static function passwordReset(array $user, string $link): bool
    {
        $content = self::heading('Restablecer tu contraseña')
            . self::paragraph('Hola ' . self::e($user['name']) . ', recibimos un pedido para restablecer la contraseña de tu cuenta.')
            . self::button('Restablecer contraseña', $link)
            . self::note('El link vence en 1 hora. Si no fuiste vos, podés ignorar este mail: tu contraseña no cambia.');

        return Mailer::send(
            $user['email'],
            'Restablecer tu contraseña · PDF Color',
            self::layout($content, 'Usá este link para elegir una contraseña nueva. Vence en 1 hora.'),
        );
    }

    /** Confirmación de pedido. $order es lo que devuelve Order::find(). */
    public static function orderCreated(array $order): bool
    {
        $isPickup = $order['delivery_method'] === 'retiro';

        $content = self::heading('Recibimos tu pedido #' . (int) $order['id'])
            . self::paragraph(
                'Hola ' . self::e($order['customer_name']) . ', ya tenemos tu pedido. '
                . ($isPickup
                    ? 'Te avisamos por mail cuando esté listo para retirar.'
                    : 'Lo preparamos y te lo enviamos a la dirección que indicaste.'),
            )
            . self::itemsTable($order)
            . self::dataTable(self::orderData($order))
            . self::button('Ver mi pedido', self::orderUrl($order));

        return Mailer::send(
            $order['customer_email'],
            'Recibimos tu pedido #' . (int) $order['id'] . ' · PDF Color',
            self::layout($content, 'Total $ ' . number_format((float) $order['total'], 2, ',', '.') . '. Ya lo estamos preparando.'),
        );
    }

    /** Aviso manual del admin: el pedido ya se puede pasar a buscar. */
    public static function orderReady(array $order): bool
    {
        $data = [];

        if (!empty($order['pickup_point_name'])) {
            $data['Dónde retirar'] = self::e($order['pickup_point_name'])
                . '<br /><span style="color:#71717a;font-weight:400">' . self::e($order['pickup_point_address']) . '</span>';
        }

        $hours = (string) Config::get('contact.hours', '');

        if ($hours !== '') {
            $data['Horarios'] = self::e($hours);
        }

        $data['Total'] = self::money($order['total']);
        $data['Pago'] = self::paymentLabel($order);

        $content = self::badge('Listo para retirar')
            . self::heading('Tu pedido #' . (int) $order['id'] . ' está listo')
            . self::paragraph('Hola ' . self::e($order['customer_name']) . ', ya terminamos de imprimir tu pedido. Podés pasar a buscarlo cuando quieras.')
            . self::dataTable($data)
            . self::itemsTable($order)
            . self::button('Ver mi pedido', self::orderUrl($order));

        return Mailer::send(
            $order['customer_email'],
            'Tu pedido #' . (int) $order['id'] . ' está listo para retirar · PDF Color',
            self::layout($content, 'Ya podés pasar a buscar tu pedido.'),
        );
    }

    /**
     * Cierra la respuesta HTTP antes de mandar el mail, para que el SMTP (que
     * puede tardar unos segundos) no demore al cliente ni al webhook. Solo para
     * mails cuyo resultado no cambia la respuesta. Llamar después de Response::json().
     */
    public static function afterResponse(callable $send): void
    {
        // Soltar la sesión: si no, los próximos requests del mismo usuario quedan
        // esperando el lock del archivo de sesión hasta que termine el envío.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } elseif (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        }

        $send();
    }

    // ---------- Datos del pedido ----------

    private static function orderData(array $order): array
    {
        $data = [];

        if ($order['delivery_method'] === 'retiro') {
            $data['Entrega'] = 'Retiro en sucursal';

            if (!empty($order['pickup_point_name'])) {
                $data['Punto de retiro'] = self::e($order['pickup_point_name'])
                    . '<br /><span style="color:#71717a;font-weight:400">' . self::e($order['pickup_point_address']) . '</span>';
            }
        } else {
            $data['Entrega'] = 'Envío a domicilio';
            $data['Dirección'] = self::e((string) $order['delivery_address']);
        }

        $data['Pago'] = self::paymentLabel($order);

        if (!empty($order['notes'])) {
            $data['Tu nota'] = self::e($order['notes']);
        }

        return $data;
    }

    private static function paymentLabel(array $order): string
    {
        $method = self::PAYMENT_METHOD_LABELS[$order['payment_method']] ?? $order['payment_method'];
        $status = self::PAYMENT_STATUS_LABELS[$order['payment_status']] ?? $order['payment_status'];

        return self::e($method) . ' · ' . self::e($status);
    }

    private static function orderUrl(array $order): string
    {
        return Config::appUrl() . '/pedidos/' . (int) $order['id'];
    }

    // ---------- Piezas del layout ----------

    private static function itemsTable(array $order): string
    {
        $th = 'padding:10px 12px;background:#f4f4f5;color:#52525b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;' . self::FONT;
        $td = 'padding:12px;border-top:1px solid #e4e4e7;color:#18181b;font-size:14px;line-height:20px;vertical-align:top;' . self::FONT;

        $rows = '';

        foreach ($order['items'] as $item) {
            $specs = [
                ucfirst((string) $item['paper_size']),
                ((int) $item['double_side']) ? 'Doble faz' : 'Simple faz',
                self::FINISH_LABELS[$item['finish']] ?? $item['finish'],
                (int) $item['pages'] . ' pág.',
            ];

            if ((float) $item['discount_percent'] > 0) {
                $specs[] = '-' . rtrim(rtrim(number_format((float) $item['discount_percent'], 2, ',', ''), '0'), ',') . '% por cantidad';
            }

            $rows .= '<tr>'
                . '<td style="' . $td . '"><strong>' . self::e($item['title']) . '</strong>'
                . '<br /><span style="color:#71717a;font-size:13px">' . self::e(implode(' · ', $specs)) . '</span></td>'
                . '<td align="center" style="' . $td . '">' . (int) $item['copies'] . '</td>'
                . '<td align="right" style="' . $td . 'white-space:nowrap">' . self::money($item['total_price']) . '</td>'
                . '</tr>';
        }

        if ((float) $order['shipping_price'] > 0) {
            $rows .= '<tr>'
                . '<td colspan="2" style="' . $td . '">Envío a domicilio</td>'
                . '<td align="right" style="' . $td . 'white-space:nowrap">' . self::money($order['shipping_price']) . '</td>'
                . '</tr>';
        }

        $total = 'padding:14px 12px;border-top:2px solid #18181b;color:#18181b;font-size:16px;font-weight:700;' . self::FONT;

        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate;overflow:hidden">'
            . '<tr>'
            . '<th align="left" style="' . $th . '">Archivo</th>'
            . '<th align="center" style="' . $th . '">Copias</th>'
            . '<th align="right" style="' . $th . '">Subtotal</th>'
            . '</tr>'
            . $rows
            . '<tr>'
            . '<td colspan="2" style="' . $total . '">Total</td>'
            . '<td align="right" style="' . $total . 'white-space:nowrap">' . self::money($order['total']) . '</td>'
            . '</tr>'
            . '</table>';
    }

    /** Tabla "etiqueta → valor". Los valores ya tienen que venir escapados. */
    private static function dataTable(array $rows): string
    {
        $html = '';
        $first = true;

        foreach ($rows as $label => $value) {
            $border = $first ? '' : 'border-top:1px solid #e4e4e7;';
            $first = false;

            $html .= '<tr>'
                . '<td width="38%" style="padding:11px 14px;' . $border . 'color:#71717a;font-size:13px;line-height:20px;vertical-align:top;' . self::FONT . '">' . self::e((string) $label) . '</td>'
                . '<td style="padding:11px 14px;' . $border . 'color:#18181b;font-size:14px;line-height:20px;font-weight:600;vertical-align:top;' . self::FONT . '">' . $value . '</td>'
                . '</tr>';
        }

        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate">'
            . $html
            . '</table>';
    }

    private static function heading(string $text): string
    {
        return '<h1 style="margin:0 0 14px;color:#18181b;font-size:22px;line-height:30px;font-weight:700;' . self::FONT . '">' . self::e($text) . '</h1>';
    }

    /** $html ya tiene que venir escapado. */
    private static function paragraph(string $html): string
    {
        return '<p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:24px;' . self::FONT . '">' . $html . '</p>';
    }

    private static function note(string $text): string
    {
        return '<p style="margin:0;color:#71717a;font-size:13px;line-height:20px;' . self::FONT . '">' . self::e($text) . '</p>';
    }

    private static function badge(string $text): string
    {
        return '<p style="margin:0 0 14px"><span style="display:inline-block;padding:4px 12px;background:#dcfce7;color:#166534;border-radius:99px;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;' . self::FONT . '">' . self::e($text) . '</span></p>';
    }

    private static function button(string $label, string $url): string
    {
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">'
            . '<tr><td align="center" bgcolor="#0b0b0d" style="border-radius:8px">'
            . '<a href="' . self::e($url) . '" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;border-radius:8px;' . self::FONT . '">' . self::e($label) . '</a>'
            . '</td></tr></table>';
    }

    private static function layout(string $content, string $preheader): string
    {
        $appUrl = self::e(Config::appUrl());
        $logo = $appUrl . '/assets/logo-email.png';
        $font = self::FONT;
        $safePreheader = self::e($preheader);
        $footer = self::footer();

        return <<<HTML
            <!DOCTYPE html>
            <html lang="es">
            <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>PDF Color</title>
            </head>
            <body style="margin:0;padding:0;background:#ececef">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ececef;font-size:1px;line-height:1px">{$safePreheader}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececef" style="background:#ececef">
            <tr><td align="center" style="padding:32px 12px">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
            <tr><td align="center" bgcolor="#0b0b0d" style="padding:22px 24px;background:#0b0b0d;border-radius:12px 12px 0 0">
            <a href="{$appUrl}" style="text-decoration:none"><img src="{$logo}" width="190" alt="PDF Color" style="display:block;width:190px;max-width:100%;height:auto;border:0;color:#ffffff;font-size:22px;font-weight:700;{$font}" /></a>
            </td></tr>
            <tr><td bgcolor="#ffffff" style="padding:32px 32px 28px;background:#ffffff;border:1px solid #e4e4e7;border-top:0;border-radius:0 0 12px 12px">
            {$content}
            </td></tr>
            <tr><td align="center" style="padding:22px 24px 0;color:#71717a;font-size:12px;line-height:19px;{$font}">
            {$footer}
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            HTML;
    }

    private static function footer(): string
    {
        $lines = ['<strong style="color:#52525b">PDF Color · Centro de copiado</strong>'];

        $address = (string) Config::get('contact.address', '');
        $hours = (string) Config::get('contact.hours', '');
        $phone = (string) Config::get('contact.phone', '');

        if ($address !== '') {
            $lines[] = self::e($address);
        }

        if ($hours !== '') {
            $lines[] = self::e($hours);
        }

        if ($phone !== '') {
            $lines[] = 'Tel. ' . self::e($phone);
        }

        $url = Config::appUrl();
        $lines[] = '<a href="' . self::e($url) . '" style="color:#52525b;text-decoration:underline">'
            . self::e((string) preg_replace('#^https?://#', '', $url)) . '</a>';

        return implode('<br />', $lines);
    }

    private static function money(mixed $value): string
    {
        return '$&nbsp;' . number_format((float) $value, 2, ',', '.');
    }

    private static function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
