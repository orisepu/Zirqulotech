'use client'
import React from 'react'
import CuestionarioComercialIphone from '@/components/grading/CuestionarioComercialIphone'

export default function Page() {
  return (
    <div style={{ padding: 16 }}>
      <CuestionarioComercialIphone
        paramsModelo={{ V_Aplus: 500, pp_A: 0.08, pp_B: 0.12, pp_C: 0.15, V_suelo: 50, pr_bateria: 60, pr_pantalla: 120, pr_chasis: 140 }}
        modelos={[
          { id: 1, nombre: 'iPhone 13', capacidades: [ { id: 101, nombre: '128 GB' }, { id: 102, nombre: '256 GB' } ] },
          { id: 2, nombre: 'iPhone 14', capacidades: [ { id: 201, nombre: '128 GB' }, { id: 202, nombre: '256 GB' } ] },
        ]}
      />
    </div>
  )
}