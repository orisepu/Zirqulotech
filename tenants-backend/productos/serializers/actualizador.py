from rest_framework import serializers
from productos.models import TareaActualizacionLikewize,LikewizeCazadorTarea

class TareaLikewizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TareaActualizacionLikewize
        fields = "__all__"


class LikewizeCazadorResultadoSerializer(serializers.Serializer):
    tarea_uuid = serializers.UUIDField(source="id", read_only=True)
    status = serializers.CharField()

    stats = serializers.SerializerMethodField()
    matches = serializers.SerializerMethodField()
    no_cazados_bd = serializers.SerializerMethodField()

    def get_stats(self, obj: LikewizeCazadorTarea):
        total = int(obj.total_likewize or 0)
        cazados = len(obj.matches or [])
        no_cazados = max(total - cazados, 0) if total else 0
        porcentaje = (cazados / total * 100) if total else 0.0
        return {
            "total_likewize": total,
            "cazados": cazados,
            "no_cazados": no_cazados,
            "porcentaje_cazados": round(porcentaje, 2),
        }

    def get_matches(self, obj: LikewizeCazadorTarea):
        rows = obj.matches or []
        out = []
        for r in rows:
            out.append({
                "likewize_nombre": r.get("likewize_nombre") or r.get("likewize_name") or r.get("nombre_likewize") or "",
                "bd_modelo": r.get("bd_modelo") or r.get("modelo") or r.get("equipo_nombre") or r.get("nombre_equipo") or "",
                "bd_capacidad": r.get("bd_capacidad") or r.get("capacidad") or r.get("equipo_capacidad"),
                "capacidad_id": r.get("capacidad_id") or r.get("cap_id"),
            })
        return out

    def get_no_cazados_bd(self, obj: LikewizeCazadorTarea):
        rows = obj.no_cazados_bd or []
        out = []
        for r in rows:
            out.append({
                "bd_modelo": r.get("bd_modelo") or r.get("modelo") or r.get("equipo_nombre") or "",
                "bd_capacidad": r.get("bd_capacidad") or r.get("capacidad"),
                "capacidad_id": r.get("capacidad_id") or r.get("cap_id"),
            })
        return out

    def to_representation(self, obj: LikewizeCazadorTarea):
        base = super().to_representation(obj)
        base["tarea_uuid"] = str(obj.id)
        base["status"] = obj.status
        return base