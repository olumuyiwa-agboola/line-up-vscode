/**
 * Arranges lines in ascending order of length, shortest first.
 *
 * Length is measured on the trimmed line so indentation and trailing
 * whitespace don't affect the order. Lines of equal length keep their
 * original relative order.
 */
export function lineUp(lines: readonly string[]): string[] {
	return [...lines].sort((a, b) => a.trim().length - b.trim().length);
}
