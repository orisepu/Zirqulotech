# GeoIP2 Database

Esta carpeta contiene la base de datos **GeoLite2-City.mmdb** necesaria para la geolocalización de IPs en el sistema de seguridad.

## Descarga Automática

Para descargar la base de datos GeoLite2, ejecuta:

```bash
python manage.py download_geoip
```

Este comando:
- Descarga la última versión de GeoLite2-City desde MaxMind
- Extrae el archivo .mmdb en esta carpeta
- Se puede ejecutar mensualmente para mantener actualizada la base de datos

## Descarga Manual

Si prefieres descargar manualmente:

1. Regístrate en MaxMind: https://www.maxmind.com/en/geolite2/signup
2. Obtén tu Account ID y License Key
3. Descarga GeoLite2-City.mmdb
4. Coloca el archivo en esta carpeta

## Notas

- La base de datos **NO se sube** al repositorio (está en .gitignore) por su tamaño (~70MB)
- Se actualiza mensualmente por MaxMind
- Es gratuita bajo licencia Creative Commons
- Precisión: ~70% a nivel de ciudad

## Licencia

GeoLite2 Database by MaxMind
Creative Commons Attribution-ShareAlike 4.0 International License
https://www.maxmind.com/en/geolite2/eula
