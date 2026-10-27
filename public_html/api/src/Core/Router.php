<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Router mínimo con parámetros {id} y middlewares por ruta.
 * Para agregar un endpoint alcanza con sumar una línea en src/routes.php.
 */
final class Router
{
    /** @var array<int, array{method: string, pattern: string, handler: callable, middlewares: array}> */
    private array $routes = [];

    public function get(string $path, callable $handler, array $middlewares = []): void
    {
        $this->add('GET', $path, $handler, $middlewares);
    }

    public function post(string $path, callable $handler, array $middlewares = []): void
    {
        $this->add('POST', $path, $handler, $middlewares);
    }

    public function patch(string $path, callable $handler, array $middlewares = []): void
    {
        $this->add('PATCH', $path, $handler, $middlewares);
    }

    public function delete(string $path, callable $handler, array $middlewares = []): void
    {
        $this->add('DELETE', $path, $handler, $middlewares);
    }

    public function dispatch(Request $request): void
    {
        $pathMatched = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['pattern'], $request->path, $matches)) {
                continue;
            }

            $pathMatched = true;

            if ($route['method'] !== $request->method) {
                continue;
            }

            foreach ($route['middlewares'] as $middleware) {
                $middleware($request);
            }

            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            ($route['handler'])($request, $params);

            return;
        }

        throw $pathMatched
            ? new HttpException(405, 'Método no permitido')
            : HttpException::notFound('El endpoint no existe');
    }

    private function add(string $method, string $path, callable $handler, array $middlewares): void
    {
        $pattern = '#^' . preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $path) . '$#';

        $this->routes[] = compact('method', 'pattern', 'handler', 'middlewares');
    }
}
