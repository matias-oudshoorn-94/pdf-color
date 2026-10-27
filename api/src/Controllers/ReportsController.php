<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Order;
use DateTimeImmutable;

/** Reportes de ventas y actividad para el panel de administración. */
final class ReportsController
{
    private const GROUPS = ['day', 'week', 'month', 'year'];

    private const BUCKET_EXPR = [
        'day' => 'DATE(o.created_at)',
        'week' => 'DATE(DATE_SUB(o.created_at, INTERVAL WEEKDAY(o.created_at) DAY))',
        'month' => "DATE_FORMAT(o.created_at, '%Y-%m-01')",
        'year' => "DATE_FORMAT(o.created_at, '%Y-01-01')",
    ];

    private const DEFAULT_SPAN = [
        'day' => '-30 days',
        'week' => '-12 weeks',
        'month' => '-12 months',
        'year' => '-5 years',
    ];

    /** Serie temporal de ventas: ingresos y cantidad de pedidos agrupados por día/semana/mes/año. */
    public function sales(Request $request): void
    {
        $group = Validator::make($request->query)->enum('group', self::GROUPS, 'month')->validated()['group'];
        [$from, $to] = self::range($request, self::DEFAULT_SPAN[$group]);

        $bucket = self::BUCKET_EXPR[$group];

        $series = Database::select(
            "SELECT {$bucket} AS bucket,
                    COUNT(DISTINCT o.id) AS orders,
                    COALESCE(SUM(oi.total_price), 0) AS revenue
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             WHERE o.status <> 'cancelado' AND o.created_at BETWEEN :from AND :to
             GROUP BY bucket
             ORDER BY bucket",
            ['from' => $from, 'to' => $to],
        );

        Response::json(['group' => $group, 'from' => $from, 'to' => $to, 'series' => $series]);
    }

    /** KPIs resumen (ventas, pedidos, ticket promedio) y desglose por estado, para un rango. */
    public function overview(Request $request): void
    {
        [$from, $to] = self::range($request, '-30 days');

        $totals = Database::selectOne(
            "SELECT COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(oi.total_price), 0) AS revenue
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             WHERE o.status <> 'cancelado' AND o.created_at BETWEEN :from AND :to",
            ['from' => $from, 'to' => $to],
        );

        $orders = (int) $totals['orders'];
        $revenue = (float) $totals['revenue'];

        $byStatusRows = Database::select(
            'SELECT status, COUNT(*) AS total FROM orders WHERE created_at BETWEEN :from AND :to GROUP BY status',
            ['from' => $from, 'to' => $to],
        );

        $byStatus = array_fill_keys(Order::STATUSES, 0);

        foreach ($byStatusRows as $row) {
            $byStatus[$row['status']] = (int) $row['total'];
        }

        Response::json([
            'from' => $from,
            'to' => $to,
            'revenue' => $revenue,
            'orders' => $orders,
            'avgOrder' => $orders > 0 ? round($revenue / $orders, 2) : 0,
            'byStatus' => $byStatus,
        ]);
    }

    /** Top 10 materias, instituciones y archivos más vendidos (por ingresos) en un rango. */
    public function rankings(Request $request): void
    {
        [$from, $to] = self::range($request, '-30 days');
        $params = ['from' => $from, 'to' => $to];

        $files = Database::select(
            "SELECT f.id, f.title, i.name AS institution_name, s.name AS subject_name,
                    SUM(oi.copies) AS units, SUM(oi.total_price) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN files f ON f.id = oi.file_id
             LEFT JOIN institutions i ON i.id = f.institution_id
             LEFT JOIN subjects s ON s.id = f.subject_id
             WHERE o.status <> 'cancelado' AND o.created_at BETWEEN :from AND :to
             GROUP BY f.id
             ORDER BY revenue DESC
             LIMIT 10",
            $params,
        );

        $subjects = Database::select(
            "SELECT s.id, s.name, SUM(oi.copies) AS units, SUM(oi.total_price) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN files f ON f.id = oi.file_id
             JOIN subjects s ON s.id = f.subject_id
             WHERE o.status <> 'cancelado' AND o.created_at BETWEEN :from AND :to
             GROUP BY s.id
             ORDER BY revenue DESC
             LIMIT 10",
            $params,
        );

        $institutions = Database::select(
            "SELECT i.id, i.name, SUM(oi.copies) AS units, SUM(oi.total_price) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN files f ON f.id = oi.file_id
             JOIN institutions i ON i.id = f.institution_id
             WHERE o.status <> 'cancelado' AND o.created_at BETWEEN :from AND :to
             GROUP BY i.id
             ORDER BY revenue DESC
             LIMIT 10",
            $params,
        );

        Response::json([
            'from' => $from,
            'to' => $to,
            'files' => $files,
            'subjects' => $subjects,
            'institutions' => $institutions,
        ]);
    }

    /** @return array{0: string, 1: string} [from, to] como 'Y-m-d H:i:s', "to" incluye el día completo. */
    private static function range(Request $request, string $defaultSpan): array
    {
        $fromInput = (string) ($request->query('from') ?? '');
        $toInput = (string) ($request->query('to') ?? '');

        $to = $toInput !== '' ? self::parseDate($toInput) : new DateTimeImmutable('now');
        $from = $fromInput !== '' ? self::parseDate($fromInput) : $to->modify($defaultSpan);

        if ($from > $to) {
            throw HttpException::badRequest('El rango de fechas es inválido');
        }

        return [$from->format('Y-m-d 00:00:00'), $to->format('Y-m-d 23:59:59')];
    }

    private static function parseDate(string $value): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);

        if ($date === false) {
            throw HttpException::badRequest('Fecha inválida, usá el formato AAAA-MM-DD');
        }

        return $date;
    }
}
