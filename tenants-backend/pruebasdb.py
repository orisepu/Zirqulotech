from productos.models import Modelo, Capacidad

def show_caps(desc_icontains: str):
    Ms = Modelo.objects.filter(descripcion__icontains=desc_icontains).order_by('id')
    if not Ms.exists():
        print(f"[!] No hay Modelo que contenga: {desc_icontains}")
        return
    for m in Ms:
        sizes = list(Capacidad.objects.filter(modelo=m).values_list('tamaño', flat=True))
        print(f"\n[{m.id}] {m.descripcion}")
        print("  tamaños:", ", ".join(sizes) or "(sin capacidades)")

targets = [
    "iPhone 15 Pro", "iPhone 15 ", "iPhone 12", "iPhone 11",
    "iPad Pro (9,7 pulgadas) Wi-Fi", "iPad Pro (9,7 pulgadas) Cellular",
    "iPad Pro (12,9 pulgadas) Wi-Fi", "iPad Pro (12,9 pulgadas) Cellular",
    "iPad Pro de 12,9 pulgadas (6.ª generación) Wi-Fi",
    "iPad Pro de 12,9 pulgadas (6.ª generación) Cellular",
    "iPad Pro 13-inch (M4) Wi-Fi", "iPad Pro 13-inch (M4) Cellular",
]
for t in targets:
    show_caps(t)
