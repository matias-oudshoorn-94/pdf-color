<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Config;
use App\Core\Csrf;
use App\Core\HttpException;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\FileRecord;
use App\Models\PasswordReset;
use App\Models\User;
use App\Services\Emails;
use App\Services\GoogleAuth;

final class AuthController
{
    public function register(Request $request): void
    {
        RateLimiter::hit('register', $request->ip(), 10, 3600);

        $data = Validator::make($request->body())
            ->string('name', 2, 120)
            ->email('email')
            ->password('password')
            ->string('phone', 6, 40)
            ->validated();

        if (User::emailExists($data['email'])) {
            throw HttpException::badRequest('Ese email ya está registrado', ['email' => ['Ya existe una cuenta con este email']]);
        }

        $user = User::create($data['name'], $data['email'], $data['password'], $data['phone']);
        Auth::login($user);
        self::claimGuestFiles($user['id']);

        Response::json(['user' => $user, 'csrfToken' => Csrf::token()], 201);

        Emails::afterResponse(static fn () => Emails::welcome($user));
    }

    public function login(Request $request): void
    {
        $ip = $request->ip();
        RateLimiter::hit(
            'login',
            $ip,
            (int) Config::get('security.login_max_attempts'),
            (int) Config::get('security.login_window'),
        );

        $data = Validator::make($request->body())
            ->email('email')
            ->password('password', 1)
            ->validated();

        $user = User::findByEmailWithHash($data['email']);

        if ($user === null || !User::verifyPassword($user, $data['password'])) {
            throw HttpException::unauthorized('Email o contraseña incorrectos');
        }

        RateLimiter::clear('login', $ip);
        unset($user['password_hash']);
        Auth::login($user);
        self::claimGuestFiles($user['id']);

        Response::json(['user' => $user, 'csrfToken' => Csrf::token()]);
    }

    /**
     * Ingreso con Google: si el email ya tiene cuenta entra a esa (Google ya
     * verificó que la casilla es suya); si no, se crea una cuenta nueva.
     */
    public function google(Request $request): void
    {
        RateLimiter::hit('google-login', $request->ip(), 20, 900);

        $data = Validator::make($request->body())->string('credential', 20, 4096)->validated();
        $profile = GoogleAuth::verify($data['credential']);

        if ($profile === null) {
            throw HttpException::unauthorized('No pudimos validar tu cuenta de Google. Probá de nuevo.');
        }

        $user = User::findByEmail($profile['email']);
        $isNew = $user === null;

        if ($isNew) {
            $name = mb_substr($profile['name'] !== '' ? $profile['name'] : strstr($profile['email'], '@', true), 0, 120);
            // Contraseña aleatoria que nadie conoce: entra con Google, o define una
            // propia desde "Olvidé mi contraseña".
            $user = User::create($name, $profile['email'], bin2hex(random_bytes(32)), null);
        }

        Auth::login($user);
        self::claimGuestFiles($user['id']);

        Response::json(['user' => $user, 'csrfToken' => Csrf::token()], $isNew ? 201 : 200);

        if ($isNew) {
            Emails::afterResponse(static fn () => Emails::welcome($user));
        }
    }

    /** Siempre responde igual, exista o no el email: no hay que filtrar qué cuentas están registradas. */
    public function forgotPassword(Request $request): void
    {
        RateLimiter::hit('forgot-password', $request->ip(), 5, 3600);

        $data = Validator::make($request->body())->email('email')->validated();
        $user = User::findByEmail($data['email']);

        if ($user !== null) {
            $token = PasswordReset::create($user['id']);
            $link = Config::appUrl() . '/restablecer-contrasena?token=' . $token;

            Emails::passwordReset($user, $link);
        }

        Response::json(['ok' => true]);
    }

    public function resetPassword(Request $request): void
    {
        RateLimiter::hit('reset-password', $request->ip(), 10, 900);

        $data = Validator::make($request->body())
            ->string('token', 10, 255)
            ->password('password')
            ->validated();

        $reset = PasswordReset::findValidByToken($data['token']);

        if ($reset === null) {
            throw HttpException::badRequest('El link venció o no es válido. Pedí uno nuevo.');
        }

        $user = User::update((int) $reset['user_id'], ['password' => $data['password']]);
        PasswordReset::markUsed((int) $reset['id']);

        Auth::login($user);
        self::claimGuestFiles($user['id']);

        Response::json(['user' => $user, 'csrfToken' => Csrf::token()]);
    }

    /** Los archivos subidos antes de ingresar pasan a ser del usuario. */
    private static function claimGuestFiles(int $userId): void
    {
        FileRecord::claim($_SESSION[FileController::GUEST_SESSION_KEY] ?? [], $userId);
        unset($_SESSION[FileController::GUEST_SESSION_KEY]);
    }

    public function logout(Request $request): void
    {
        Auth::logout();
        Response::noContent();
    }

    public function me(Request $request): void
    {
        Response::json(['user' => Auth::user(), 'csrfToken' => Csrf::token()]);
    }

    /** Edición de los datos propios. Para cambiar email o contraseña pide la contraseña actual. */
    public function updateProfile(Request $request): void
    {
        $current = Auth::user();
        $body = $request->body();

        $validator = Validator::make($body)
            ->string('name', 2, 120)
            ->email('email')
            ->string('phone', 0, 40, required: false);

        $wantsNewPassword = !empty($body['password']);

        if ($wantsNewPassword) {
            $validator->password('password');
        }

        $data = $validator->validated();
        $emailChanged = $data['email'] !== $current['email'];

        if ($emailChanged || $wantsNewPassword) {
            $record = User::findByEmailWithHash($current['email']);

            if (!User::verifyPassword($record, (string) ($body['currentPassword'] ?? ''))) {
                throw HttpException::badRequest('Contraseña actual incorrecta', [
                    'currentPassword' => ['No coincide con tu contraseña'],
                ]);
            }
        }

        if ($emailChanged && User::emailExists($data['email'])) {
            throw HttpException::badRequest('Ese email ya está en uso', ['email' => ['Email en uso']]);
        }

        $fields = [
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
        ];

        if ($wantsNewPassword) {
            $fields['password'] = $data['password'];
        }

        Response::json(['user' => User::update($current['id'], $fields)]);
    }
}
