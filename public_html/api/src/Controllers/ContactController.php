<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Database;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

final class ContactController
{
    public function info(Request $request): void
    {
        Response::json(['contact' => Config::get('contact')]);
    }

    public function store(Request $request): void
    {
        RateLimiter::hit('contact', $request->ip(), 5, 3600);

        $data = Validator::make($request->body())
            ->string('name', 2, 120)
            ->email('email')
            ->string('message', 10, 2000)
            ->validated();

        Database::insert(
            'INSERT INTO messages (name, email, body) VALUES (?, ?, ?)',
            [$data['name'], $data['email'], $data['message']],
        );

        Response::json(['ok' => true], 201);
    }
}
