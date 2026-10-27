<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Detección de nombres parecidos para evitar duplicados cuando los usuarios cargan
 * instituciones, carreras o materias desde la subida de archivos.
 *
 * Compara "claves" normalizadas: sin tildes ni signos, con abreviaturas expandidas
 * ("Esc." = "Escuela", "Univ." = "Universidad"), números romanos pasados a arábigos
 * y sin palabras de relleno ("de", "la", "N°"). Sobre esas claves combina:
 *  - igualdad exacta (mismo nombre escrito distinto: se reutiliza sin preguntar),
 *  - siglas ("UTN" ↔ "Universidad Tecnológica Nacional"),
 *  - palabras en común tolerando errores de tipeo ("Matematica" ↔ "Matemáticas"),
 *  - distancia de edición sobre el nombre completo.
 * Si los números no coinciden ("Escuela 5" ≠ "Escuela 15", "Análisis I" ≠ "Análisis II")
 * nunca se consideran parecidos.
 *
 * No usa mbstring ni intl: el hosting puede no tenerlas (ver Core/polyfill.php).
 */
final class Similarity
{
    /** Desde este puntaje se le muestra al usuario como "¿es alguna de estas?". */
    public const THRESHOLD = 0.78;

    private const ACCENTS = [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'Á' => 'a', 'À' => 'a', 'Â' => 'a', 'Ä' => 'a', 'Ã' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'É' => 'e', 'È' => 'e', 'Ê' => 'e', 'Ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'Í' => 'i', 'Ì' => 'i', 'Î' => 'i', 'Ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o', 'Ó' => 'o', 'Ò' => 'o', 'Ô' => 'o', 'Ö' => 'o', 'Õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'Ú' => 'u', 'Ù' => 'u', 'Û' => 'u', 'Ü' => 'u',
        'ñ' => 'n', 'Ñ' => 'n', 'ç' => 'c', 'Ç' => 'c',
    ];

    private const ABBREVIATIONS = [
        'esc' => 'escuela', 'escs' => 'escuela', 'inst' => 'instituto', 'instit' => 'instituto',
        'univ' => 'universidad', 'col' => 'colegio', 'coleg' => 'colegio', 'fac' => 'facultad',
        'tec' => 'tecnica', 'tecn' => 'tecnica', 'nac' => 'nacional', 'prov' => 'provincial',
        'sec' => 'secundaria', 'secund' => 'secundaria', 'prim' => 'primaria', 'educ' => 'educacion',
        'prof' => 'profesorado', 'lic' => 'licenciatura', 'ing' => 'ingenieria', 'tecnicatura' => 'tecnicatura',
        'gral' => 'general', 'mun' => 'municipal', 'priv' => 'privado', 'sta' => 'santa', 'sto' => 'santo',
        'pte' => 'presidente', 'dr' => 'doctor', 'dra' => 'doctora',
    ];

    /** Palabras que no distinguen un nombre de otro ("N°", "de", "la"…). */
    private const STOPWORDS = [
        'de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'en', 'a', 'al', 'con', 'para', 'por',
        'n', 'no', 'nro', 'nros', 'num', 'numero', 'nos',
    ];

    private const ROMAN = [
        'i' => '1', 'ii' => '2', 'iii' => '3', 'iv' => '4', 'v' => '5',
        'vi' => '6', 'vii' => '7', 'viii' => '8', 'ix' => '9', 'x' => '10',
    ];

    /**
     * Candidatos parecidos a $name, del más al menos parecido.
     *
     * @param list<array<string, mixed>> $candidates filas con al menos 'name'
     * @return list<array<string, mixed>> las mismas filas + 'exact' (bool), como mucho $limit
     */
    public static function rank(string $name, array $candidates, int $limit = 5): array
    {
        $scored = [];

        foreach ($candidates as $candidate) {
            $score = self::score($name, (string) $candidate['name']);

            if ($score >= self::THRESHOLD) {
                $scored[] = ['row' => $candidate + ['exact' => $score >= 1.0], 'score' => $score];
            }
        }

        usort($scored, static fn (array $a, array $b) => $b['score'] <=> $a['score']);

        return array_map(static fn (array $s) => $s['row'], array_slice($scored, 0, $limit));
    }

    /** 1.0 = mismo nombre escrito distinto; 0 = nada que ver. */
    public static function score(string $a, string $b): float
    {
        $tokensA = self::tokens($a);
        $tokensB = self::tokens($b);

        if ($tokensA === [] || $tokensB === []) {
            return 0.0;
        }

        $keyA = self::key($tokensA);
        $keyB = self::key($tokensB);

        if ($keyA === $keyB) {
            return 1.0;
        }

        // Distinto número = distinta escuela / distinto nivel de la materia.
        $numbersA = self::numbers($tokensA);
        $numbersB = self::numbers($tokensB);

        if ($numbersA !== [] && $numbersB !== [] && $numbersA !== $numbersB) {
            return 0.0;
        }

        if (self::isAcronymOf($a, $b) || self::isAcronymOf($b, $a)) {
            return 0.9;
        }

        $words = self::wordScore($tokensA, $tokensB);
        $whole = self::ratio(implode(' ', $tokensA), implode(' ', $tokensB));

        // Solo la igualdad de claves cuenta como "es el mismo": un parecido por
        // tipeo ("Fisca" / "Física") se le pregunta al usuario, no se asume.
        return min(0.95, max($words, $whole));
    }

    /**
     * Prolijidad mínima del nombre que escribió el usuario: espacios de más y,
     * si lo escribió todo en minúsculas, mayúscula inicial en cada palabra.
     */
    public static function tidy(string $name): string
    {
        $name = trim((string) preg_replace('/\s+/u', ' ', $name));

        if ($name === '' || preg_match('/[A-ZÁÉÍÓÚÑÜ]/u', $name)) {
            return $name;
        }

        $words = explode(' ', $name);

        foreach ($words as $i => $word) {
            if ($i > 0 && in_array($word, ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al'], true)) {
                continue;
            }

            $words[$i] = self::ucfirst($word);
        }

        return implode(' ', $words);
    }

    /** @return list<string> */
    private static function tokens(string $text, bool $keepStopwords = false): array
    {
        $text = strtolower(strtr($text, self::ACCENTS));
        // "1ro", "2do", "3er", "4to" → número solo.
        $text = (string) preg_replace('/\b(\d+)\s*(?:ro|do|er|to|mo|vo|no)\b/u', '$1', $text);
        $text = (string) preg_replace('/[^a-z0-9]+/', ' ', $text);

        $tokens = [];

        foreach (explode(' ', trim($text)) as $token) {
            if ($token === '') {
                continue;
            }

            $token = self::ABBREVIATIONS[$token] ?? self::ROMAN[$token] ?? $token;

            if (!$keepStopwords && in_array($token, self::STOPWORDS, true)) {
                continue;
            }

            // Singular y plural cuentan igual ("Matemáticas" = "Matemática").
            if (strlen($token) > 4 && str_ends_with($token, 's') && !ctype_digit($token)) {
                $token = substr($token, 0, -1);
            }

            $tokens[] = $token;
        }

        return $tokens;
    }

    /** Clave independiente del orden de las palabras. */
    private static function key(array $tokens): string
    {
        sort($tokens);

        return implode(' ', $tokens);
    }

    private static function numbers(array $tokens): array
    {
        $numbers = array_values(array_filter($tokens, static fn (string $t) => ctype_digit($t)));
        $numbers = array_map(static fn (string $n) => ltrim($n, '0') ?: '0', $numbers);
        sort($numbers);

        return $numbers;
    }

    /** "UTN" / "U.N.M.d.P." como sigla de "Universidad Nacional de Mar del Plata". */
    private static function isAcronymOf(string $short, string $long): bool
    {
        // Los números ya se compararon aparte: "EES 5" se evalúa como "EES".
        $withoutNumbers = static fn (array $tokens) => array_values(array_filter($tokens, static fn (string $t) => !ctype_digit($t)));
        $shortTokens = $withoutNumbers(self::tokens($short, true));

        if ($shortTokens === []) {
            return false;
        }

        // Una sigla escrita con puntos ("U.T.N.") queda como letras sueltas.
        $acronym = count($shortTokens) > 1 && max(array_map('strlen', $shortTokens)) === 1
            ? implode('', $shortTokens)
            : (count($shortTokens) === 1 ? $shortTokens[0] : '');

        if (strlen($acronym) < 2 || strlen($acronym) > 6 || ctype_digit($acronym)) {
            return false;
        }

        $allWords = $withoutNumbers(self::tokens($long, true));
        $meaningful = $withoutNumbers(self::tokens($long));

        if (count($meaningful) < 2) {
            return false;
        }

        $allInitials = implode('', array_map(static fn (string $t) => $t[0], $allWords));
        $mainInitials = implode('', array_map(static fn (string $t) => $t[0], $meaningful));

        // La sigla puede incluir o no las iniciales de "de", "del"… ("UNMdP" vs "UNMP").
        if (self::isSubsequence($acronym, $allInitials) && self::isSubsequence($mainInitials, $acronym)) {
            return true;
        }

        // O abreviar solo una parte del nombre: "UTN" en "Universidad Tecnológica
        // Nacional - Facultad Regional Mar del Plata".
        return strlen($acronym) >= 3 && str_starts_with($mainInitials, $acronym);
    }

    private static function isSubsequence(string $needle, string $haystack): bool
    {
        $position = 0;

        for ($i = 0, $n = strlen($needle); $i < $n; $i++) {
            $position = strpos($haystack, $needle[$i], $position);

            if ($position === false) {
                return false;
            }

            $position++;
        }

        return true;
    }

    /** Palabras en común (tolerando errores de tipeo en cada una). */
    private static function wordScore(array $a, array $b): float
    {
        [$small, $large] = count($a) <= count($b) ? [$a, $b] : [$b, $a];
        $matched = 0;

        foreach ($small as $word) {
            foreach ($large as $i => $other) {
                if ($word === $other || (strlen($word) >= 4 && self::ratio($word, $other) >= 0.8)) {
                    $matched++;
                    unset($large[$i]);
                    break;
                }
            }
        }

        $contained = (float) $matched / count($small);
        $overlap = (float) $matched / max(count($a), count($b));

        // "Ingeniería en Sistemas" dentro de "Ingeniería en Sistemas de Información",
        // o "UTN" dentro de "UTN 4" (lo único que sobra es el número).
        $leftover = array_filter($large, static fn (string $t) => !ctype_digit($t));

        if ($contained === 1.0 && (count($small) >= 2 || $leftover === [])) {
            return max(0.85, $overlap);
        }

        return ($contained + $overlap) / 2;
    }

    private static function ratio(string $a, string $b): float
    {
        $max = max(strlen($a), strlen($b));

        if ($max === 0) {
            return 1.0;
        }

        // levenshtein() de PHP admite hasta 255 caracteres; los nombres tienen como mucho 160.
        return 1 - levenshtein(substr($a, 0, 255), substr($b, 0, 255)) / $max;
    }

    private static function ucfirst(string $word): string
    {
        $first = (string) preg_replace('/^(.).*$/us', '$1', $word);
        $rest = substr($word, strlen($first));
        $upper = strtr($first, ['á' => 'Á', 'é' => 'É', 'í' => 'Í', 'ó' => 'Ó', 'ú' => 'Ú', 'ñ' => 'Ñ', 'ü' => 'Ü']);

        return ($upper === $first ? strtoupper($first) : $upper) . $rest;
    }
}
