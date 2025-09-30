#!/bin/bash

echo "=== Actualizando imports a nueva estructura por scope ==="

# Función para actualizar imports en un directorio
update_imports_in_dir() {
    local dir=$1
    echo "Actualizando imports en: $dir"

    # Shared components (UI básicos)
    find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
        -e 's|@/components/ui/|@/shared/components/ui/|g' \
        -e 's|@/components/inputs/|@/shared/components/forms/inputs/|g' \
        -e 's|@/components/layout/|@/shared/components/layout/|g' \
        -e 's|@/components/etiquetas/|@/shared/components/ui/tags/|g' \
        -e 's|@/components/notificaciones/|@/shared/components/feedback/|g' \
        -e 's|@/utils/|@/shared/utils/|g' \
        -e 's|@/hooks/|@/shared/hooks/|g' \
        -e 's|@/lib/|@/shared/lib/|g' \
        -e 's|@/types/|@/shared/types/|g' \
        -e 's|@/constants/|@/shared/constants/|g' \
        {} \;

    # Features components
    find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
        -e 's|@/components/formularios/Clientes/|@/features/clients/components/forms/|g' \
        -e 's|@/components/clientes/|@/features/clients/components/|g' \
        -e 's|@/components/formularios/dispositivos/|@/features/opportunities/components/forms/|g' \
        -e 's|@/components/oportunidades/|@/features/opportunities/components/|g' \
        -e 's|@/components/grading/|@/features/opportunities/components/grading/|g' \
        -e 's|@/components/dispositivos/|@/features/opportunities/components/devices/|g' \
        -e 's|@/components/dashboards/|@/features/dashboards/components/|g' \
        -e 's|@/components/chat/|@/features/chat/components/|g' \
        -e 's|@/components/contratos/|@/features/contracts/components/|g' \
        -e 's|@/components/pdf/|@/features/contracts/components/pdf/|g' \
        -e 's|@/components/objetivos/|@/features/objectives/components/|g' \
        {} \;

    # Shared components específicos
    find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
        -e 's|@/components/TablaReactiva2|@/shared/components/TablaReactiva2|g' \
        -e 's|@/components/TablaColumnas2|@/shared/components/TablaColumnas2|g' \
        -e 's|@/components/Sparkline|@/shared/components/data-display/Sparkline|g' \
        -e 's|@/components/DatosRecogida|@/shared/components/DatosRecogida|g' \
        -e 's|@/components/cambiosestadochipselector|@/shared/components/cambiosestadochipselector|g' \
        -e 's|@/components/LoginForm|@/features/auth/components/LoginForm|g' \
        -e 's|@/components/ReactQueryProvider|@/features/auth/components/providers/ReactQueryProvider|g' \
        {} \;
}

# Actualizar imports en app/
update_imports_in_dir "src/app"

echo "=== Actualización de imports completada ==="
echo "Verifica que no hay errores de compilación ejecutando: pnpm typecheck"