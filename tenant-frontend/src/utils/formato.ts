export function formatoEuros(valor: number, decimales = 2): string {
  if (valor == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}
