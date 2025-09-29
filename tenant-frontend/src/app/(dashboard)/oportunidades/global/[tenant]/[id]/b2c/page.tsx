'use client';
import AdminB2CPanel from "@/features/contracts/components/AdminB2CPanel";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant;
  const oportunidadId = params?.id;

  return <AdminB2CPanel tenant={tenant} oportunidadId={oportunidadId} />;
}