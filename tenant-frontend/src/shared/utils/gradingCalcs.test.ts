import {
  pasaGatesComercial,
  gradoEsteticoDesdeTabla,
  calcularOferta,
  topesDesdeV,
  vSueloDesdeMax,
  vSueloReglaInfo,
  calcularEstadoDetallado
} from './gradingCalcs'
import {
  CuestionarioComercialInput,
  DisplayImageStatus,
  GlassStatus,
  HousingStatus,
  GradingParamsPorModelo
} from '@/shared/types/grading'

describe('gradingCalcs', () => {
  describe('pasaGatesComercial', () => {
    const baseInput: CuestionarioComercialInput = {
      enciende: true,
      carga: true,
      display_image_status: DisplayImageStatus.OK,
      glass_status: GlassStatus.NONE,
      housing_status: HousingStatus.SIN_SIGNOS,
      funcional_basico_ok: true,
      battery_health_pct: 85
    }

    it('should return OK for perfect device', () => {
      const result = pasaGatesComercial(baseInput)
      expect(result.gate).toBe('OK')
    })

    it('should return DEFECTUOSO when device does not turn on', () => {
      const input = { ...baseInput, enciende: false }
      const result = pasaGatesComercial(input)
      expect(result.gate).toBe('DEFECTUOSO')
    })

    it('should return DEFECTUOSO when device does not charge', () => {
      const input = { ...baseInput, carga: false }
      const result = pasaGatesComercial(input)
      expect(result.gate).toBe('DEFECTUOSO')
    })

    it('should return DEFECTUOSO for bad display status', () => {
      const input = { ...baseInput, display_image_status: DisplayImageStatus.PIX }
      const result = pasaGatesComercial(input)
      expect(result.gate).toBe('DEFECTUOSO')
    })

    it('should return DEFECTUOSO for severely damaged glass', () => {
      const damagedGlassStatuses = [GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK]

      damagedGlassStatuses.forEach(glassStatus => {
        const input = { ...baseInput, glass_status: glassStatus }
        const result = pasaGatesComercial(input)
        expect(result.gate).toBe('DEFECTUOSO')
      })
    })

    it('should return DEFECTUOSO for bent housing', () => {
      const input = { ...baseInput, housing_status: HousingStatus.DOBLADO }
      const result = pasaGatesComercial(input)
      expect(result.gate).toBe('DEFECTUOSO')
    })

    it('should return DEFECTUOSO when basic functionality fails', () => {
      const input = { ...baseInput, funcional_basico_ok: false }
      const result = pasaGatesComercial(input)
      expect(result.gate).toBe('DEFECTUOSO')
    })
  })

  describe('gradoEsteticoDesdeTabla', () => {
    it('should return A+ for perfect condition', () => {
      const grade = gradoEsteticoDesdeTabla(GlassStatus.NONE, HousingStatus.SIN_SIGNOS)
      expect(grade).toBe('A+')
    })

    it('should return A for near perfect condition', () => {
      expect(gradoEsteticoDesdeTabla(GlassStatus.NONE, HousingStatus.MINIMOS)).toBe('A')
      expect(gradoEsteticoDesdeTabla(GlassStatus.MICRO, HousingStatus.SIN_SIGNOS)).toBe('A')
      expect(gradoEsteticoDesdeTabla(GlassStatus.MICRO, HousingStatus.MINIMOS)).toBe('A')
    })

    it('should return B for moderate wear', () => {
      expect(gradoEsteticoDesdeTabla(GlassStatus.VISIBLE, HousingStatus.ALGUNOS)).toBe('B')
      expect(gradoEsteticoDesdeTabla(GlassStatus.MICRO, HousingStatus.ALGUNOS)).toBe('B')
      expect(gradoEsteticoDesdeTabla(GlassStatus.VISIBLE, HousingStatus.MINIMOS)).toBe('B')
    })

    it('should return C for poor condition', () => {
      expect(gradoEsteticoDesdeTabla(GlassStatus.DEEP, HousingStatus.DESGASTE_VISIBLE)).toBe('C')
      expect(gradoEsteticoDesdeTabla(GlassStatus.CHIP, HousingStatus.SIN_SIGNOS)).toBe('C')
    })
  })

  describe('topesDesdeV', () => {
    it('should calculate correct price thresholds', () => {
      const V_Aplus = 1000
      const pp_A = 0.1  // 10%
      const pp_B = 0.15 // 15%
      const pp_C = 0.2  // 20%

      const result = topesDesdeV(V_Aplus, pp_A, pp_B, pp_C)

      expect(result.V_A).toBe(900)    // 1000 * (1 - 0.1)
      expect(result.V_B).toBe(765)    // 900 * (1 - 0.15)
      expect(result.V_C).toBe(612)    // 765 * (1 - 0.2)
    })

    it('should handle edge case with zero percentages', () => {
      const result = topesDesdeV(500, 0, 0, 0)
      expect(result.V_A).toBe(500)
      expect(result.V_B).toBe(500)
      expect(result.V_C).toBe(500)
    })
  })

  describe('vSueloDesdeMax', () => {
    it('should calculate correct floor price for different ranges', () => {
      // Range 1: hasta 100 (20% / min 10€)
      expect(vSueloDesdeMax(50)).toBe(10)   // max(10, 50*0.2=10) = 10
      expect(vSueloDesdeMax(80)).toBe(15)   // max(10, 80*0.2=16) rounded to 15

      // Range 2: 100-199 (18% / min 15€)
      expect(vSueloDesdeMax(150)).toBe(25)  // max(15, 150*0.18=27) rounded to 25

      // Range 6: >=800 (8% / min 50€)
      expect(vSueloDesdeMax(1000)).toBe(80) // max(50, 1000*0.08=80) = 80
    })

    it('should round to multiples of 5', () => {
      expect(vSueloDesdeMax(127) % 5).toBe(0)
      expect(vSueloDesdeMax(333) % 5).toBe(0)
    })
  })

  describe('vSueloReglaInfo', () => {
    it('should return correct rule information', () => {
      const result = vSueloReglaInfo(150)
      expect(result.value).toBe(vSueloDesdeMax(150))
      expect(result.pct).toBe(0.18)
      expect(result.min).toBe(15)
      expect(result.label).toContain('100–199')
    })
  })

  describe('calcularOferta', () => {
    const baseInput: CuestionarioComercialInput = {
      enciende: true,
      carga: true,
      display_image_status: DisplayImageStatus.OK,
      glass_status: GlassStatus.NONE,
      housing_status: HousingStatus.SIN_SIGNOS,
      funcional_basico_ok: true,
      battery_health_pct: 90
    }

    const baseParams: GradingParamsPorModelo = {
      V_Aplus: 1000,
      pp_A: 0.1,
      pp_B: 0.15,
      pp_C: 0.2,
      pr_bateria: 100,
      pr_pantalla: 200,
      pr_chasis: 150,
      V_suelo: 50
    }

    it('should calculate correct offer for perfect device', () => {
      const result = calcularOferta(baseInput, baseParams, 0.1)

      expect(result.gate).toBe('OK')
      expect(result.grado_estetico).toBe('A+')
      expect(result.V_tope).toBe(1000)
      expect(result.deducciones.pr_bat).toBe(0) // battery > 85%
      expect(result.deducciones.pr_pant).toBe(0) // display OK
      expect(result.deducciones.pr_chas).toBe(0) // housing perfect
      expect(result.oferta).toBeGreaterThan(0)
    })

    it('should apply battery deduction for low battery health', () => {
      const input = { ...baseInput, battery_health_pct: 80 }
      const result = calcularOferta(input, baseParams, 0.1)

      expect(result.deducciones.pr_bat).toBe(100)
    })

    it('should apply screen deduction for damaged display', () => {
      const input = { ...baseInput, display_image_status: DisplayImageStatus.PIX }
      const result = calcularOferta(input, baseParams, 0.1)

      expect(result.gate).toBe('DEFECTUOSO')
    })

    it('should apply chassis deduction for visible wear', () => {
      const input = { ...baseInput, housing_status: HousingStatus.DESGASTE_VISIBLE }
      const result = calcularOferta(input, baseParams, 0.1)

      expect(result.deducciones.pr_chas).toBe(150)
    })

    it('should respect minimum floor price', () => {
      const highDeductionParams = {
        ...baseParams,
        pr_bateria: 500,
        pr_pantalla: 500,
        pr_chasis: 500
      }

      const damagedInput = {
        ...baseInput,
        battery_health_pct: 70,
        housing_status: HousingStatus.DESGASTE_VISIBLE
      }

      const result = calcularOferta(damagedInput, highDeductionParams, 0.1)
      expect(result.oferta).toBeGreaterThanOrEqual(highDeductionParams.V_suelo)
    })

    it('should round offer to multiples of 5', () => {
      const result = calcularOferta(baseInput, baseParams, 0.1)
      expect(result.oferta % 5).toBe(0)
    })
  })

  describe('calcularEstadoDetallado', () => {
    const baseInput = {
      estado_fisico: 'perfecto' as const,
      estado_funcional: 'funciona' as const,
      salud_bateria_pct: 95,
      pantalla_funcional_puntos_bril: false,
      pantalla_funcional_pixeles_muertos: false,
      pantalla_funcional_lineas_quemaduras: false,
      desgaste_lateral: 'ninguno' as const,
      desgaste_trasero: 'ninguno' as const
    }

    it('should return excelente for perfect device', () => {
      const result = calcularEstadoDetallado(baseInput)
      expect(result).toBe('excelente')
    })

    it('should return a_revision for damaged device', () => {
      const damagedInput = { ...baseInput, estado_fisico: 'dañado' as const }
      const result = calcularEstadoDetallado(damagedInput)
      expect(result).toBe('a_revision')
    })

    it('should return a_revision for non-functional device', () => {
      const nonFunctionalInput = { ...baseInput, estado_funcional: 'no_enciende' as const }
      const result = calcularEstadoDetallado(nonFunctionalInput)
      expect(result).toBe('a_revision')
    })

    it('should return a_revision for screen with lines/burns', () => {
      const screenDamagedInput = { ...baseInput, pantalla_funcional_lineas_quemaduras: true }
      const result = calcularEstadoDetallado(screenDamagedInput)
      expect(result).toBe('a_revision')
    })

    it('should penalize low battery health', () => {
      const lowBatteryInput = { ...baseInput, salud_bateria_pct: 65 }
      const result = calcularEstadoDetallado(lowBatteryInput)
      // Low battery (65%) should result in bueno or lower, not excelente
      expect(['bueno', 'a_revision']).toContain(result)
    })

    it('should penalize wear levels', () => {
      const wornInput = {
        ...baseInput,
        desgaste_lateral: 'alto' as const,
        desgaste_trasero: 'medio' as const
      }
      const result = calcularEstadoDetallado(wornInput)
      // Should be penalized but still acceptable
      expect(['muy_bueno', 'bueno']).toContain(result)
    })

    it('should handle edge case with null battery', () => {
      const noBatteryInput = { ...baseInput, salud_bateria_pct: null }
      const result = calcularEstadoDetallado(noBatteryInput)
      expect(result).toBe('excelente') // Should not crash
    })
  })
})