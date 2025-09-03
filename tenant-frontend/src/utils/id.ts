export interface HasId {
  id?: number | string;
  uuid?: string;
  hashid?: string;
}

export function getId(entity: HasId): string | number | undefined {
  return entity.hashid ?? entity.uuid ?? entity.id;
}
export function getIdlink(entity: HasId): string | number | undefined {
  return entity.uuid ?? entity.hashid ??  entity.id;
}