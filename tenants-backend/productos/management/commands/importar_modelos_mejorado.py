import pandas as pd
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from productos.models import Modelo, Capacidad
import chardet
import re
from decimal import Decimal, ROUND_HALF_UP

class Command(BaseCommand):
    help = "Importa modelos y capacidades con precios B2B y B2C desde un archivo CSV al esquema público."

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Ruta del archivo CSV.')
        parser.add_argument('--encoding', type=str, default=None, help='Codificación del archivo (auto si no se especifica).')
        parser.add_argument('--dry-run', action='store_true', help='Simula la importación sin guardar nada.')

    def handle(self, *args, **options):
        csv_path = options['csv']
        encoding = options['encoding']
        dry_run = options['dry_run']

        def dec(valor):
            try:
                return Decimal(str(valor)).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
            except:
                return None

        if not encoding:
            with open(csv_path, 'rb') as f:
                rawdata = f.read(8192)
                result = chardet.detect(rawdata)
                encoding = result['encoding']
                self.stdout.write(f"🌐 Encoding detectado: {encoding}")

        try:
            df = pd.read_csv(csv_path, encoding=encoding, delimiter='\t')
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error al leer el archivo CSV: {e}"))
            return

        df.columns = df.columns.str.strip()

        columnas_requeridas = [
            "Modelo", "Tipo", "Pantalla", "Procesador", "Año",
            "Almacenamiento", "PrecioB2B", "PrecioB2C"
        ]
        for col in columnas_requeridas:
            if col not in df.columns:
                self.stderr.write(self.style.ERROR(f"Falta la columna requerida: {col}"))
                return

        def normalizar_generico(texto):
            return str(texto).strip().title()

        def normalizar_almacenamiento(valor):
            valor = str(valor).strip().upper()
            valor = re.sub(r"(\d+)\s?(GB|TB)", r"\1 \2", valor)
            valor = valor.replace("SSD", " SSD").replace("HDD", " HDD").replace("FUSION DRIVE", " Fusion Drive")
            return re.sub(r"\s+", " ", valor).strip()

        def convertir_precio(valor):
            if isinstance(valor, float):
                return valor
            texto = str(valor).strip().lower().replace("€", "").replace(",", ".")
            if texto in ["", "n/a", "nan", "“nan”", "”nan”"]:
                return None
            try:
                return float(texto)
            except ValueError:
                return None

        def limpiar_y_convertir(col):
            return col.apply(lambda v: convertir_precio(str(v).replace("“", "").replace("”", "").strip()))

        df = df.dropna(subset=["Modelo", "Tipo", "Almacenamiento"])
        df["descripcion"] = df["Modelo"].astype(str).str.strip()
        df["tipo"] = df["Tipo"].astype(str).str.strip()
        df["pantalla"] = df["Pantalla"].apply(normalizar_generico)
        df["procesador"] = df["Procesador"].apply(normalizar_generico)
        df["año"] = df["Año"].fillna(0).astype(int)
        df["almacenamiento"] = df["Almacenamiento"].apply(normalizar_almacenamiento)
        df["preciob2b"] = limpiar_y_convertir(df["PrecioB2B"])
        df["preciob2c"] = limpiar_y_convertir(df["PrecioB2C"])

        self.stdout.write("🔍 Valores no válidos en PrecioB2B:")
        self.stdout.write(str(df[df["preciob2b"].isna()]["PrecioB2B"].unique()))
        self.stdout.write("🔍 Valores no válidos en PrecioB2C:")
        self.stdout.write(str(df[df["preciob2c"].isna()]["PrecioB2C"].unique()))

        creados_modelos = 0
        creadas_capacidades = 0
        actualizadas_capacidades = 0
        total_filas = 0
        errores = []

        with schema_context("public"):
            for index, row in df.iterrows():
                total_filas += 1
                try:
                    modelo_existente = Modelo.objects.filter(
                        descripcion__iexact=row["descripcion"],
                        tipo=row["tipo"],
                        pantalla=row["pantalla"],
                        procesador=row["procesador"],
                        año=row["año"],
                    ).first()

                    if modelo_existente:
                        modelo = modelo_existente
                        if modelo.descripcion != row["descripcion"]:
                            self.stdout.write(f"✏️ Corrigiendo casing: '{modelo.descripcion}' → '{row['descripcion']}'")
                            if not dry_run:
                                modelo.descripcion = row["descripcion"]
                                modelo.save(update_fields=["descripcion"])
                    else:
                        if dry_run:
                            self.stdout.write(f"[DRY RUN] Se crearía modelo: {row['descripcion']}")
                            continue
                        modelo = Modelo.objects.create(
                            descripcion=row["descripcion"],
                            tipo=row["tipo"],
                            pantalla=row["pantalla"],
                            procesador=row["procesador"],
                            año=row["año"],
                        )
                        creados_modelos += 1
                        self.stdout.write(f"✅ Modelo creado: {modelo.descripcion}")

                    tamaño_normalizado = normalizar_almacenamiento(row["almacenamiento"])

                    capacidad = next(
                        (c for c in Capacidad.objects.filter(modelo=modelo)
                         if normalizar_almacenamiento(c.tamaño) == tamaño_normalizado),
                        None
                    )

                    if not capacidad:
                        if not dry_run:
                            capacidad = Capacidad.objects.create(
                                modelo=modelo,
                                tamaño=tamaño_normalizado,
                            )
                        creado_c = True
                        self.stdout.write(f"➕ Capacidad creada: {modelo.descripcion} - {tamaño_normalizado}")
                    else:
                        creado_c = False

                    if not dry_run:
                        actualizado = False

                        nuevo_b2b = dec(row["preciob2b"])
                        actual_b2b = dec(capacidad.precio_b2b)
                        if nuevo_b2b is not None and nuevo_b2b != actual_b2b:
                            self.stdout.write(f"🔄 [{modelo.descripcion} - {capacidad.tamaño}] PrecioB2B: {actual_b2b} → {nuevo_b2b}")
                            capacidad.precio_b2b = nuevo_b2b
                            actualizado = True

                        nuevo_b2c = dec(row["preciob2c"])
                        actual_b2c = dec(capacidad.precio_b2c)
                        if nuevo_b2c is not None and nuevo_b2c != actual_b2c:
                            self.stdout.write(f"🔄 [{modelo.descripcion} - {capacidad.tamaño}] PrecioB2C: {actual_b2c} → {nuevo_b2c}")
                            capacidad.precio_b2c = nuevo_b2c
                            actualizado = True

                        if actualizado:
                            capacidad.save()
                            actualizadas_capacidades += 1
                            self.stdout.write(f"💾 Capacidad actualizada: {modelo.descripcion} - {capacidad.tamaño}")

                        if creado_c:
                            creadas_capacidades += 1

                except Exception as e:
                    errores.append(df.iloc[[index]])
                    self.stderr.write(self.style.ERROR(f"❌ Error en fila {index + 2}: {e}"))

        if errores and not dry_run:
            pd.concat(errores).to_csv("filas_erroneas.csv", index=False)

        self.stdout.write(self.style.SUCCESS(f"\n📊 Filas procesadas: {total_filas}"))
        self.stdout.write(self.style.SUCCESS(f"✅ Modelos creados: {creados_modelos}"))
        self.stdout.write(self.style.SUCCESS(f"✅ Capacidades creadas: {creadas_capacidades}"))
        self.stdout.write(self.style.SUCCESS(f"🔁 Capacidades actualizadas: {actualizadas_capacidades}"))
