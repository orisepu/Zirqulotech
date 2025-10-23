/**
 * Device ID Utilities
 *
 * Utilities for extracting and normalizing device IDs from various API response formats.
 * The backend API has inconsistent field naming for capacity IDs, so these utilities
 * handle all possible variations.
 */

export type DeviceIdFields = {
  capacidad_id?: number | string | null;
  cap_id?: number | string | null;
  capacidad?: { id?: number | string } | null;
  capacidadId?: number | string | null;
  id_capacidad?: number | string | null;
};

/**
 * Normalizes a value to a number or returns null
 *
 * Handles multiple input types:
 * - number: validates with Number.isFinite
 * - string: trims, validates, and converts to number
 * - other: returns null
 *
 * @param value - The value to normalize
 * @returns The numeric value or null
 */
function normalizeToNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && !Number.isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
  }

  return null;
}

/**
 * Safely extracts numeric capacity ID from device object
 *
 * Tries multiple field names in priority order to handle API inconsistencies:
 * 1. capacidad_id
 * 2. cap_id
 * 3. capacidad.id
 * 4. capacidadId
 * 5. id_capacidad
 *
 * @param device - Device object with potential capacity ID fields
 * @returns The extracted capacity ID or null if not found
 *
 * @example
 * const capacityId = extractCapacidadId({ capacidad_id: 42 }); // 42
 * const capacityId = extractCapacidadId({ cap_id: "42" }); // 42
 * const capacityId = extractCapacidadId({ capacidad: { id: 42 } }); // 42
 * const capacityId = extractCapacidadId({}); // null
 */
export function extractCapacidadId(device: DeviceIdFields | null): number | null {
  if (!device) return null;

  const candidates = [
    device.capacidad_id,
    device.cap_id,
    device.capacidad?.id,
    device.capacidadId,
    device.id_capacidad,
  ];

  for (const candidate of candidates) {
    const numericValue = normalizeToNumber(candidate);
    if (numericValue !== null) return numericValue;
  }

  return null;
}

/**
 * Type guard to check if a device has a valid capacity ID
 *
 * @param device - Device object to check
 * @returns True if device has a valid capacity ID
 */
export function hasCapacidadId(device: DeviceIdFields | null): device is DeviceIdFields {
  return extractCapacidadId(device) !== null;
}
