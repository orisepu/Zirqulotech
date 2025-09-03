import io
from PIL import Image

MAX_BYTES = 8 * 1024 * 1024  # 8MB
MIN_W, MIN_H = 600, 400

def sanitize_image(file) -> io.BytesIO:
    # limita tamaño
    file.seek(0, 2)
    size = file.tell()
    if size > MAX_BYTES:
        raise ValueError("La imagen supera el tamaño máximo permitido (8MB).")
    file.seek(0)

    img = Image.open(file)
    if img.format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError("Formato no permitido. Usa JPG/PNG/WEBP.")
    if img.width < MIN_W or img.height < MIN_H:
        raise ValueError("Resolución insuficiente (mínimo 600x400).")

    # re-encode para eliminar EXIF/metadata
    rgb = img.convert("RGB")
    out = io.BytesIO()
    rgb.save(out, format="JPEG", quality=85, optimize=True)
    out.seek(0)
    return out
