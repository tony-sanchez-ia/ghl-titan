/**
 * Presets de estilo del design system clásico (claro/oscuro).
 * Usar estos presets en vez de repetir clases en cada componente.
 */
export const ui = {
  card: 'bg-card border border-border rounded-xl shadow-sm',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-fg font-medium hover:bg-bg transition-colors',
  buttonPrimary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity',
  input:
    'block w-full rounded-lg border border-border bg-card text-fg placeholder-muted px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors',
}
