// Motor de reglas para asignación automática de palets

export interface ReglaAsignacion {
  id: string;
  nombre: string;
  prioridad: number;
  activa: boolean;
  condiciones: {
    campo: string; // nombre_abreviado, peso_total_kg, vidrio_simple, etc.
    operador: 'contiene' | 'igual' | 'mayor' | 'menor' | 'entre';
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
    for (const regla of this.reglas) {
      if (!regla.activa) continue;

      if (this.evaluarCondiciones(producto, regla.condiciones)) {
        return {
          zona: regla.acciones.zona || 'expediciones',
          subzona: regla.acciones.subzona || 'H',
          prioridad: this.convertirPrioridad(regla.acciones.prioridad),
          reglaAplicada: regla.nombre
        };
      }
    }

    return null; // No se aplicó ninguna regla
  }

  // Evaluar todas las condiciones de una regla (AND lógico)
  private evaluarCondiciones(producto: any, condiciones: ReglaAsignacion['condiciones']): boolean {
    return condiciones.every(condicion => {
      const valorProducto = this.obtenerValorCampo(producto, condicion.campo);
      return this.evaluarCondicion(valorProducto, condicion.operador, condicion.valor);
    });
  }

  // Evaluar una condición individual
  private evaluarCondicion(valor: any, operador: string, valorEsperado: any): boolean {
    switch (operador) {
      case 'contiene':
        return String(valor).toLowerCase().includes(String(valorEsperado).toLowerCase());
      case 'igual':
        return valor === valorEsperado;
      case 'mayor':
        return Number(valor) > Number(valorEsperado);
      case 'menor':
        return Number(valor) < Number(valorEsperado);
      case 'entre':
        const [min, max] = valorEsperado as [number, number];
        const num = Number(valor);
        return num >= min && num <= max;
      default:
        return false;
    }
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

  // Ejemplos de reglas por defecto
  static getReglasPorDefecto(): ReglaAsignacion[] {
    return [
      {
        id: '1',
        nombre: 'Clientes REUGLAS',
        prioridad: 1,
        activa: true,
        condiciones: [
          {
            campo: 'nombre_abreviado',
            operador: 'contiene',
            valor: 'REUGLAS'
          }
        ],
        acciones: {
          zona: 'expediciones',
          subzona: 'H'
        }
      },
      {
        id: '2',
        nombre: 'Palets pesados (>200kg)',
        prioridad: 2,
        activa: true,
        condiciones: [
          {
            campo: 'peso_total_kg',
            operador: 'mayor',
            valor: 200
          }
        ],
        acciones: {
          zona: 'cms',
          subzona: 'D'
        }
      },
      {
        id: '3',
        nombre: 'Vidrio simple',
        prioridad: 3,
        activa: true,
        condiciones: [
          {
            campo: 'vidrio_simple',
            operador: 'igual',
            valor: 1
          }
        ],
        acciones: {
          zona: 'pulidoras',
          subzona: 'F'
        }
      },
      {
        id: '4',
        nombre: 'Entrega urgente (<7 días)',
        prioridad: 4,
        activa: true,
        condiciones: [
          {
            campo: 'dias_hasta_entrega',
            operador: 'menor',
            valor: 7
          }
        ],
        acciones: {
          prioridad: 'alta'
        }
      }
    ];
  }
}
