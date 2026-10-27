<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Models\Settings;

final class SettingsController
{
    /** Configuración pública del sitio: precios para armar presupuestos y claves públicas de Google. */
    public function show(Request $request): void
    {
        Response::json([
            'settings' => Settings::get(),
            'google' => [
                'clientId' => (string) Config::get('google.client_id', ''),
                'mapsApiKey' => (string) Config::get('google.maps_api_key', ''),
            ],
        ]);
    }
}
