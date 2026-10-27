<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Paginación y orden para los listados del panel.
 * La columna de orden se valida contra una lista blanca: nunca se interpola
 * texto del usuario en el SQL.
 */
final class Paginator
{
    public const PER_PAGE_OPTIONS = [10, 25, 50, 100];

    private function __construct(
        public readonly int $page,
        public readonly int $perPage,
        public readonly string $sort,
        public readonly string $dir,
        public readonly string $sortColumn,
    ) {
    }

    /**
     * @param array<string, string> $sortable mapa clave pública => columna SQL
     */
    public static function fromRequest(Request $request, array $sortable, string $defaultSort): self
    {
        $page = max(1, (int) $request->query('page', 1));

        $perPage = (int) $request->query('perPage', 25);
        $perPage = in_array($perPage, self::PER_PAGE_OPTIONS, true) ? $perPage : 25;

        $sort = (string) $request->query('sort', $defaultSort);
        $sort = array_key_exists($sort, $sortable) ? $sort : $defaultSort;

        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        return new self($page, $perPage, $sort, $dir, $sortable[$sort]);
    }

    public function offset(): int
    {
        return ($this->page - 1) * $this->perPage;
    }

    /** Fragmento SQL ya saneado. */
    public function orderBy(): string
    {
        return "ORDER BY {$this->sortColumn} {$this->dir}";
    }

    public function limit(): string
    {
        return "LIMIT {$this->perPage} OFFSET {$this->offset()}";
    }

    /** @param array<int, mixed> $items */
    public function response(array $items, int $total): array
    {
        return [
            'items' => $items,
            'total' => $total,
            'page' => $this->page,
            'perPage' => $this->perPage,
            'pages' => max(1, (int) ceil($total / $this->perPage)),
            'sort' => $this->sort,
            'dir' => $this->dir,
        ];
    }
}
