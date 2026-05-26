// Motor de reglas para asignación automática de palets

export interface ReglaAsignacion {
  id: string;
  nombre: string;
  prioridad: number;
  activa: boolean;
  esDefecto?: boolean;
  condiciones: {
    campo: string; // nombre_abreviado, peso_total_kg, vidrio_simple, etc.
    operador: 'contiene' | 'igual' | 'mayor' | 'mayor_igual' | 'menor' | 'menor_igual' | 'entre' | 'fecha_antes' | 'fecha_despues' | 'fecha_entre';
    valor: string | number | string | [number, number];
  }[];
  acciones: {
    zona?: string;
    subzona?: string;
    prioridad?: 'baja' | 'media' | 'alta';
  };
}

export interface ResultadoAsignacion {
  zona: string;
  subzona: string;
  prioridad: number;
  reglaAplicada?: string;
}

export class RuleEngine {
  private reglas: ReglaAsignacion[] = [];

  constructor(reglas: ReglaAsignacion[] = []) {
    this.reglas = reglas.sort((a, b) => a.prioridad - b.prioridad);
  }

  // Evaluar un producto contra todas las reglas
  evaluarProducto(producto: any): ResultadoAsignacion | null {
    const reglaDefecto = this.reglas.find(regla => regla.esDefecto && regla.activa);

    for (const regla of this.reglas) {
      if (!regla.activa) continue;
      if (regla.esDefecto) continue;

      if (this.evaluarCondiciones(producto, regla.condiciones)) {
        return {
          zona: regla.acciones.zona || 'expediciones',
          subzona: regla.acciones.subzona || 'H',
          prioridad: this.convertirPrioridad(regla.acciones.prioridad),
          reglaAplicada: regla.nombre
        };
      }
    }

    if (reglaDefecto) {
      return {
        zona: reglaDefecto.acciones.zona || 'expediciones',
        subzona: reglaDefecto.acciones.subzona || 'H',
        prioridad: this.convertirPrioridad(reglaDefecto.acciones.prioridad),
        reglaAplicada: reglaDefecto.nombre
      };
    }

    return null; // No se aplicó ninguna regla
  }

  // Evaluar todas las condiciones de una regla (AND lógico)
  private evaluarCondiciones(producto: any, condiciones: ReglaAsignacion['condiciones']): boolean {
    const condicionesValidas = condiciones.filter(condicion =>
      condicion.campo &&
      condicion.operador &&
      condicion.valor !== '' &&
      condicion.valor !== null &&
      condicion.valor !== undefined
    );

    if (condicionesValidas.length === 0) return false;

    return condicionesValidas.every(condicion => {
      const valorProducto = this.obtenerValorCampo(producto, condicion.campo);
      return this.evaluarCondicion(valorProducto, condicion.operador, condicion.valor);
    });
  }

  // Evaluar una condición individual
  private evaluarCondicion(valor: any, operador: string, valorEsperado: any): boolean {
    switch (operador) {
      case 'contiene':
        return String(valor ?? '').toLowerCase().includes(String(valorEsperado ?? '').toLowerCase());
      case 'igual':
        return this.normalizarValor(valor) === this.normalizarValor(valorEsperado);
      case 'mayor':
        return this.normalizarNumero(valor) > this.normalizarNumero(valorEsperado);
      case 'mayor_igual':
        return this.normalizarNumero(valor) >= this.normalizarNumero(valorEsperado);
      case 'menor':
        return this.normalizarNumero(valor) < this.normalizarNumero(valorEsperado);
      case 'menor_igual':
        return this.normalizarNumero(valor) <= this.normalizarNumero(valorEsperado);
      case 'entre': {
        const [min, max] = Array.isArray(valorEsperado)
          ? valorEsperado
          : String(valorEsperado).split(/[-;]/).map(numero => this.normalizarNumero(numero));
        const num = this.normalizarNumero(valor);
        return num >= min && num <= max;
      }
      case 'fecha_antes':
        return this.normalizarFecha(valor) < this.normalizarFecha(valorEsperado);
      case 'fecha_despues':
        return this.normalizarFecha(valor) > this.normalizarFecha(valorEsperado);
      case 'fecha_entre': {
        const [inicio, fin] = String(valorEsperado).split(/[;]/).map(fecha => this.normalizarFecha(fecha));
        const fecha = this.normalizarFecha(valor);
        return fecha >= inicio && fecha <= fin;
      }
      default:
        return false;
    }
  }

  private normalizarValor(valor: any): string | number | boolean {
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'number') return valor;

    const valorTexto = String(valor ?? '').trim().toLowerCase();
    if (valorTexto === 'true' || valorTexto === 'sí' || valorTexto === 'si') return true;
    if (valorTexto === 'false' || valorTexto === 'no') return false;

    const valorNumerico = this.normalizarNumero(valorTexto);
    if (valorTexto !== '' && !Number.isNaN(valorNumerico)) return valorNumerico;

    return valorTexto;
  }

  private normalizarNumero(valor: any): number {
    return Number(String(valor ?? '').trim().replace(',', '.'));
  }

  private normalizarFecha(valor: any): number {
    if (valor && typeof valor.toDate === 'function') return valor.toDate().getTime();
    if (valor instanceof Date) return valor.getTime();

    const normalized = String(valor ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\u202F/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const meses: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11
    };

    const spanishDateMatch = normalized.match(/(\d{1,2}) de (\w+) de (\d{4})(?: a las (\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
    if (spanishDateMatch) {
      const [, dayValue, monthValue, yearValue, hourValue = '0', minuteValue = '0', secondValue = '0'] = spanishDateMatch;
      const month = meses[monthValue.toLowerCase()];
      if (month !== undefined) {
        return new Date(
          Number(yearValue),
          month,
          Number(dayValue),
          Number(hourValue),
          Number(minuteValue),
          Number(secondValue)
        ).getTime();
      }
    }

    const parsed = Date.parse(normalized.replace('UTC', 'GMT').replace(/\//g, '-'));
    return Number.isNaN(parsed) ? NaN : parsed;
  }

  // Obtener valor anidado de un objeto (ej: producto.cliente.nombre)
  private obtenerValorCampo(objeto: any, campo: string): any {
    return campo.split('.').reduce((actual, clave) => actual?.[clave], objeto);
  }

  // Convertir prioridad a número
  private convertirPrioridad(prioridad?: string): number {
    switch (prioridad) {
      case 'alta': return 3;
      case 'media': return 2;
      case 'baja': return 1;
      default: return 2;
    }
  }

  // Actualizar reglas
  actualizarReglas(reglas: ReglaAsignacion[]) {
    this.reglas = reglas.sort((a, b) => a.prioridad - b.prioridad);
  }

  // Obtener reglas activas
  getReglasActivas(): ReglaAsignacion[] {
    return this.reglas.filter(regla => regla.activa);
  }

  // Regla por defecto para productos sin reglas asociadas
  static getReglasPorDefecto(): ReglaAsignacion[] {
    return [
      {
        id: 'default-fallback-rule',
        nombre: 'Regla por defecto',
        prioridad: 0,
        activa: true,
        esDefecto: true,
        condiciones: [],
        acciones: {
          zona: 'expediciones',
          subzona: 'H'
        }
      }
    ];
  }
}
