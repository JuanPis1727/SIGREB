/**
 * ============================================================================
 * SIGREB - SISTEMA DE GESTIÓN DE RESERVAS BIBLIOTECARIAS (ITM)
 * Arquitectura Vanilla JS (ES6+) + Patrón de Diseño State (3 Entidades UML)
 * Persistencia en localStorage + Historias de Usuario HU-001 a HU-005
 * ============================================================================
 */

// Utilidad de Encriptación Simulada (RNF Seguridad: Contraseñas encriptadas)
function hashPassword(rawPassword) {
  let hash = 5381;
  const salted = `SIGREB_ITM_2026::${rawPassword}`;
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash) + salted.charCodeAt(i);
    hash = hash & hash;
  }
  return `ENC_SHA_${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

// ============================================================================
// 1. PATRÓN STATE #1: ESTADOS DE LA ENTIDAD RESERVA (Figura 9.1.1 UML)
// ============================================================================
class EstadoReserva {
  aprobar(reserva) { throw new Error("Método aprobar() no implementado"); }
  cancelar(reserva) { throw new Error("Método cancelar() no implementado"); }
  finalizar(reserva, condicionEjemplar) { throw new Error("Método finalizar() no implementado"); }
  editarReserva(reserva, nuevaFechaReserva, nuevaFechaEntrega, hayConflicto) {
    throw new Error("Método editarReserva() no implementado");
  }
  getNombre() { throw new Error("Método getNombre() no implementado"); }
  getCssClass() { throw new Error("Método getCssClass() no implementado"); }
}

class EstadoPendiente extends EstadoReserva {
  aprobar(reserva) {
    // Asegurar que el ejemplar esté en estado Reservado
    if (reserva.ejemplar && reserva.ejemplar.getNombreEstado() === "Disponible") {
      reserva.ejemplar.reservar();
    }
    reserva.material.sincronizarEstadoGeneral();
    reserva.cambiarEstado(new EstadoConfirmada());
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} APROBADA (Pendiente ➔ Confirmada). Ejemplar [${reserva.ejemplar.codigoBarras}] confirmado como 'Reservado'.`
    };
  }

  cancelar(reserva) {
    if (reserva.ejemplar) {
      reserva.ejemplar.liberarPorCancelacion();
    }
    reserva.material.sincronizarEstadoGeneral();
    reserva.cambiarEstado(new EstadoCancelada());
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} CANCELADA desde Pendiente. Ejemplar [${reserva.ejemplar ? reserva.ejemplar.codigoBarras : reserva.material.codigo}] liberado a 'Disponible' de forma inmediata.`
    };
  }

  finalizar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): No se puede finalizar ni registrar devolución de la Reserva #${reserva.idReserva} porque aún está PENDIENTE de aprobación.`
    };
  }

  editarReserva(reserva, nuevaFechaReserva, nuevaFechaEntrega, hayConflicto) {
    if (hayConflicto) {
      return {
        exito: false,
        mensaje: `Aviso de Disponibilidad: No es posible renovar. El ejemplar cuenta con una reserva activa para la fecha solicitada.`
      };
    }
    reserva.fechaReserva = nuevaFechaReserva;
    reserva.fechaEntrega = nuevaFechaEntrega;
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} (PENDIENTE): Fechas actualizadas a [${nuevaFechaReserva} ➔ ${nuevaFechaEntrega}] sin conflicto.`
    };
  }

  getNombre() { return "PENDIENTE"; }
  getCssClass() { return "badge-pendiente"; }
}

class EstadoConfirmada extends EstadoReserva {
  aprobar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): La Reserva #${reserva.idReserva} ya se encuentra CONFIRMADA y vigente.`
    };
  }

  cancelar(reserva) {
    if (reserva.ejemplar) {
      reserva.ejemplar.liberarPorCancelacion();
    }
    reserva.material.sincronizarEstadoGeneral();
    reserva.cambiarEstado(new EstadoCancelada());
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} CANCELADA. El ejemplar [${reserva.ejemplar ? reserva.ejemplar.codigoBarras : reserva.material.codigo}] vuelve a 'Disponible' inmediatamente para otros usuarios.`
    };
  }

  finalizar(reserva, condicionEjemplar = "BUEN_ESTADO") {
    let detalleEjemplar = "";
    if (reserva.ejemplar) {
      // Si el ejemplar estaba Reservado y se devuelve directamente, primero pasa por entrega/devolución en su State
      const resEj = reserva.ejemplar.registrarDevolucion(condicionEjemplar);
      detalleEjemplar = resEj.mensaje;
    }
    reserva.material.sincronizarEstadoGeneral();
    reserva.cambiarEstado(new EstadoFinalizada());
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} FINALIZADA con éxito. ${detalleEjemplar}`
    };
  }

  editarReserva(reserva, nuevaFechaReserva, nuevaFechaEntrega, hayConflicto) {
    if (hayConflicto) {
      return {
        exito: false,
        mensaje: `Aviso de Disponibilidad: No es posible renovar. El ejemplar cuenta con una reserva activa para la fecha solicitada.`
      };
    }
    reserva.fechaReserva = nuevaFechaReserva;
    reserva.fechaEntrega = nuevaFechaEntrega;
    return {
      exito: true,
      mensaje: `Reserva #${reserva.idReserva} (CONFIRMADA): Fechas renovadas a [${nuevaFechaReserva} ➔ ${nuevaFechaEntrega}].`
    };
  }

  getNombre() { return "CONFIRMADA"; }
  getCssClass() { return "badge-confirmada"; }
}

class EstadoCancelada extends EstadoReserva {
  aprobar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): La Reserva #${reserva.idReserva} está CANCELADA y no puede reactivarse.`
    };
  }

  cancelar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): La Reserva #${reserva.idReserva} ya se encuentra en estado CANCELADA.`
    };
  }

  finalizar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): No se puede finalizar una reserva que fue CANCELADA.`
    };
  }

  editarReserva(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): No se pueden editar las fechas de la Reserva #${reserva.idReserva} porque está CANCELADA.`
    };
  }

  getNombre() { return "CANCELADA"; }
  getCssClass() { return "badge-cancelada"; }
}

class EstadoFinalizada extends EstadoReserva {
  aprobar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): La Reserva #${reserva.idReserva} ya concluyó su ciclo de vida (FINALIZADA).`
    };
  }

  cancelar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): No se puede cancelar la Reserva #${reserva.idReserva} porque ya fue FINALIZADA.`
    };
  }

  finalizar(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): La Reserva #${reserva.idReserva} ya fue devuelta y FINALIZADA.`
    };
  }

  editarReserva(reserva) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Reserva): No se pueden modificar fechas de una reserva FINALIZADA.`
    };
  }

  getNombre() { return "FINALIZADA"; }
  getCssClass() { return "badge-finalizada"; }
}

// ============================================================================
// 2. PATRÓN STATE #2: ESTADOS DE LA ENTIDAD EJEMPLAR / EstadoMaterial (Fig 9.1.2)
// Ciclo: Disponible <-> Reservado -> Prestado -> Disponible / En Reparación
// ============================================================================
class EstadoMaterial {
  reservar(ejemplar) { throw new Error("No implementado"); }
  liberarPorCancelacion(ejemplar) { throw new Error("No implementado"); }
  entregarEnPrestamo(ejemplar) { throw new Error("No implementado"); }
  registrarDevolucion(ejemplar, condicion) { throw new Error("No implementado"); }
  enviarAReparacion(ejemplar) { throw new Error("No implementado"); }
  finalizarReparacion(ejemplar) { throw new Error("No implementado"); }
  getNombre() { throw new Error("No implementado"); }
  getCssClass() { throw new Error("No implementado"); }
}

class EstadoEjemplarDisponible extends EstadoMaterial {
  reservar(ejemplar) {
    ejemplar.cambiarEstado(new EstadoEjemplarReservado());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] pasa de 'Disponible' a 'Reservado'.` };
  }
  liberarPorCancelacion(ejemplar) {
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] ya está 'Disponible'.` };
  }
  entregarEnPrestamo(ejemplar) {
    ejemplar.cambiarEstado(new EstadoEjemplarPrestado());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] entregado al cliente: pasa a 'Prestado'.` };
  }
  registrarDevolucion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] ya figura como 'Disponible'.`
    };
  }
  enviarAReparacion(ejemplar) {
    ejemplar.condicionFisica = "Con daño reportado";
    ejemplar.cambiarEstado(new EstadoEjemplarEnReparacion());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] enviado a 'En Reparación' por daño físico.` };
  }
  finalizarReparacion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] no está en reparación; ya está 'Disponible'.`
    };
  }
  getNombre() { return "Disponible"; }
  getCssClass() { return "status-disponible"; }
}

class EstadoEjemplarReservado extends EstadoMaterial {
  reservar(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] ya se encuentra 'Reservado'.`
    };
  }
  liberarPorCancelacion(ejemplar) {
    ejemplar.cambiarEstado(new EstadoEjemplarDisponible());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] liberado: 'Reservado' ➔ 'Disponible'.` };
  }
  entregarEnPrestamo(ejemplar) {
    ejemplar.cambiarEstado(new EstadoEjemplarPrestado());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] entregado físicamente: 'Reservado' ➔ 'Prestado'.` };
  }
  registrarDevolucion(ejemplar, condicion = "BUEN_ESTADO") {
    if (condicion === "CON_DANO") {
      ejemplar.condicionFisica = "Deterioro en devolución";
      ejemplar.cambiarEstado(new EstadoEjemplarEnReparacion());
      return {
        exito: true,
        mensaje: `Ejemplar [${ejemplar.codigoBarras}] devuelto CON DAÑO: pasa a 'En Reparación'.`
      };
    }
    ejemplar.condicionFisica = "Óptimo";
    ejemplar.cambiarEstado(new EstadoEjemplarDisponible());
    return {
      exito: true,
      mensaje: `Ejemplar [${ejemplar.codigoBarras}] devuelto en buen estado: regresa a 'Disponible'.`
    };
  }
  enviarAReparacion(ejemplar) {
    ejemplar.condicionFisica = "Con daño reportado";
    ejemplar.cambiarEstado(new EstadoEjemplarEnReparacion());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] pasa a 'En Reparación'.` };
  }
  finalizarReparacion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] está 'Reservado', no en reparación.`
    };
  }
  getNombre() { return "Reservado"; }
  getCssClass() { return "status-reservado"; }
}

class EstadoEjemplarPrestado extends EstadoMaterial {
  reservar(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): No se puede reservar de inmediato el ejemplar [${ejemplar.codigoBarras}] porque está 'Prestado'.`
    };
  }
  liberarPorCancelacion(ejemplar) {
    ejemplar.cambiarEstado(new EstadoEjemplarDisponible());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] restituido a 'Disponible'.` };
  }
  entregarEnPrestamo(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] ya está 'Prestado' a un usuario.`
    };
  }
  registrarDevolucion(ejemplar, condicion = "BUEN_ESTADO") {
    if (condicion === "CON_DANO") {
      ejemplar.condicionFisica = "Deterioro en préstamo";
      ejemplar.cambiarEstado(new EstadoEjemplarEnReparacion());
      return {
        exito: true,
        mensaje: `Devolución con daño registrada: Ejemplar [${ejemplar.codigoBarras}] pasa de 'Prestado' a 'En Reparación'.`
      };
    }
    ejemplar.condicionFisica = "Óptimo";
    ejemplar.cambiarEstado(new EstadoEjemplarDisponible());
    return {
      exito: true,
      mensaje: `Devolución exitosa: Ejemplar [${ejemplar.codigoBarras}] pasa de 'Prestado' a 'Disponible'.`
    };
  }
  enviarAReparacion(ejemplar) {
    ejemplar.condicionFisica = "Deterioro en préstamo";
    ejemplar.cambiarEstado(new EstadoEjemplarEnReparacion());
    return { exito: true, mensaje: `Ejemplar [${ejemplar.codigoBarras}] enviado de 'Prestado' a 'En Reparación'.` };
  }
  finalizarReparacion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] está 'Prestado', no en reparación.`
    };
  }
  getNombre() { return "Prestado"; }
  getCssClass() { return "status-prestado"; }
}

class EstadoEjemplarEnReparacion extends EstadoMaterial {
  reservar(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] está 'En Reparación' y no puede reservarse.`
    };
  }
  liberarPorCancelacion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] continúa 'En Reparación' hasta finalizar mantenimiento.`
    };
  }
  entregarEnPrestamo(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): No se puede prestar el ejemplar [${ejemplar.codigoBarras}] mientras esté 'En Reparación'.`
    };
  }
  registrarDevolucion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] ya fue devuelto y se encuentra 'En Reparación'.`
    };
  }
  enviarAReparacion(ejemplar) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Ejemplar): El ejemplar [${ejemplar.codigoBarras}] ya está 'En Reparación'.`
    };
  }
  finalizarReparacion(ejemplar) {
    ejemplar.condicionFisica = "Restaurado / Óptimo";
    ejemplar.cambiarEstado(new EstadoEjemplarDisponible());
    return {
      exito: true,
      mensaje: `Reparación terminada: Ejemplar [${ejemplar.codigoBarras}] vuelve de 'En Reparación' a 'Disponible'.`
    };
  }
  getNombre() { return "En Reparación"; }
  getCssClass() { return "status-reparacion"; }
}

// ============================================================================
// 3. PATRÓN STATE #3: ESTADOS DE LA ENTIDAD CLIENTE (Figura 9.1.3 UML)
// Ciclo: Activo <-> En Morosidad (estadoSancion = true) <-> Inactivo
// ============================================================================
class EstadoCliente {
  validarPermisoReserva(cliente) { throw new Error("No implementado"); }
  aplicarSancionMora(cliente, monto, fechaHasta) { throw new Error("No implementado"); }
  regularizarMora(cliente) { throw new Error("No implementado"); }
  desactivarCuenta(cliente) { throw new Error("No implementado"); }
  activarCuenta(cliente) { throw new Error("No implementado"); }
  getNombre() { throw new Error("No implementado"); }
  getCssClass() { throw new Error("No implementado"); }
}

class EstadoClienteActivo extends EstadoCliente {
  validarPermisoReserva() {
    return { permitido: true, mensaje: "Cliente activo y sin sanciones." };
  }
  aplicarSancionMora(cliente, monto = 15000, fechaHasta = "2026-12-15") {
    cliente.estadoSancion = true;
    cliente.morosidad = monto;
    cliente.fechaFinSancion = fechaHasta;
    cliente.cambiarEstadoCliente(new EstadoClienteEnMorosidad());
    return {
      exito: true,
      mensaje: `Cliente ${cliente.nombre} (${cliente.documento}) pasa de 'Activo' a 'En Morosidad'. Sanción activa hasta ${fechaHasta}.`
    };
  }
  regularizarMora(cliente) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): El cliente ${cliente.nombre} ya está 'Activo' y no presenta morosidad.`
    };
  }
  desactivarCuenta(cliente) {
    cliente.estado = false;
    cliente.cambiarEstadoCliente(new EstadoClienteInactivo());
    return {
      exito: true,
      mensaje: `Cuenta de ${cliente.nombre} desactivada por administración ('Activo' ➔ 'Inactivo').`
    };
  }
  activarCuenta(cliente) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): La cuenta de ${cliente.nombre} ya se encuentra 'Activa'.`
    };
  }
  getNombre() { return "Activo"; }
  getCssClass() { return "status-activo"; }
}

class EstadoClienteEnMorosidad extends EstadoCliente {
  validarPermisoReserva(cliente) {
    const fecha = cliente.fechaFinSancion || "2026-12-15";
    return {
      permitido: false,
      mensaje: `Error de Validación: El usuario presenta una sanción activa hasta ${fecha}. Operación denegada`
    };
  }
  aplicarSancionMora(cliente) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): El cliente ${cliente.nombre} ya se encuentra 'En Morosidad'.`
    };
  }
  regularizarMora(cliente) {
    cliente.estadoSancion = false;
    cliente.morosidad = 0;
    cliente.fechaFinSancion = null;
    cliente.cambiarEstadoCliente(new EstadoClienteActivo());
    return {
      exito: true,
      mensaje: `Morosidad regularizada para ${cliente.nombre}. Estado actualizado: 'En Morosidad' ➔ 'Activo'.`
    };
  }
  desactivarCuenta(cliente) {
    cliente.estado = false;
    cliente.cambiarEstadoCliente(new EstadoClienteInactivo());
    return {
      exito: true,
      mensaje: `Cuenta en mora de ${cliente.nombre} pasa a 'Inactivo' por administración.`
    };
  }
  activarCuenta() {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): Debe regularizar primero la morosidad del cliente para pasarlo a 'Activo'.`
    };
  }
  getNombre() { return "En Morosidad"; }
  getCssClass() { return "status-moroso"; }
}

class EstadoClienteInactivo extends EstadoCliente {
  validarPermisoReserva(cliente) {
    return {
      permitido: false,
      mensaje: `Error de Validación: La cuenta del cliente ${cliente.nombre} (${cliente.documento}) se encuentra INACTIVA. Operación denegada`
    };
  }
  aplicarSancionMora() {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): No se puede sancionar una cuenta 'Inactiva'. Reactívela primero.`
    };
  }
  regularizarMora() {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): La cuenta está 'Inactiva'. Debe reactivarla desde gestión de cuentas.`
    };
  }
  desactivarCuenta(cliente) {
    return {
      exito: false,
      mensaje: `Bloqueo State (Cliente): La cuenta de ${cliente.nombre} ya está 'Inactiva'.`
    };
  }
  activarCuenta(cliente) {
    cliente.estado = true;
    cliente.estadoSancion = false;
    cliente.morosidad = 0;
    cliente.fechaFinSancion = null;
    cliente.cambiarEstadoCliente(new EstadoClienteActivo());
    return {
      exito: true,
      mensaje: `Cuenta de ${cliente.nombre} reactivada exitosamente ('Inactivo' ➔ 'Activo').`
    };
  }
  getNombre() { return "Inactivo"; }
  getCssClass() { return "status-inactivo"; }
}

// ============================================================================
// 4. CLASES DE DOMINIO DEL DIAGRAMA DE CLASES UML (Sección 8.4)
// ============================================================================
class Usuario {
  constructor(idUsuario, documento, nombre, email, contrasenaHash, rol, estado = true) {
    this.idUsuario = idUsuario;
    this.documento = documento;
    this.nombre = nombre;
    this.email = email;
    this.contrasenaHash = contrasenaHash;
    this.rol = rol; // 'Cliente', 'Bibliotecario', 'Administrador'
    this.estado = estado;
  }

  iniciarSesion(passwordIngresada) {
    const hashCalculado = hashPassword(passwordIngresada);
    return this.contrasenaHash === hashCalculado;
  }
}

class Cliente extends Usuario {
  constructor(idUsuario, documento, nombre, email, contrasenaHash, estadoSancion = false, morosidad = 0, fechaFinSancion = null, estadoCuenta = true, nombreEstadoCliente = null) {
    super(idUsuario, documento, nombre, email, contrasenaHash, "Cliente", estadoCuenta);
    this.estadoSancion = estadoSancion;
    this.morosidad = morosidad;
    this.fechaFinSancion = fechaFinSancion;
    this.estadoClienteActual = this.instanciarEstadoInicial(nombreEstadoCliente, estadoCuenta, estadoSancion);
  }

  instanciarEstadoInicial(nombreEstado, estadoCuenta, estadoSancion) {
    if (nombreEstado === "Inactivo" || !estadoCuenta) return new EstadoClienteInactivo();
    if (nombreEstado === "En Morosidad" || estadoSancion) return new EstadoClienteEnMorosidad();
    return new EstadoClienteActivo();
  }

  cambiarEstadoCliente(nuevoEstado) {
    this.estadoClienteActual = nuevoEstado;
  }

  getNombreEstadoCliente() {
    return this.estadoClienteActual.getNombre();
  }

  getCssClassEstadoCliente() {
    return this.estadoClienteActual.getCssClass();
  }

  validarPermisoReserva() {
    return this.estadoClienteActual.validarPermisoReserva(this);
  }

  aplicarSancion(monto, fechaHasta) {
    return this.estadoClienteActual.aplicarSancionMora(this, monto, fechaHasta);
  }

  regularizarMora() {
    return this.estadoClienteActual.regularizarMora(this);
  }

  desactivarCuenta() {
    return this.estadoClienteActual.desactivarCuenta(this);
  }

  activarCuenta() {
    return this.estadoClienteActual.activarCuenta(this);
  }
}

class Bibliotecario extends Usuario {
  constructor(idUsuario, documento, nombre, email, contrasenaHash, turno = "Mañana (07:00 - 15:00)") {
    super(idUsuario, documento, nombre, email, contrasenaHash, "Bibliotecario", true);
    this.turno = turno;
  }
}

class Administrador extends Bibliotecario {
  constructor(idUsuario, documento, nombre, email, contrasenaHash) {
    super(idUsuario, documento, nombre, email, contrasenaHash, "Jornada Completa");
    this.rol = "Administrador";
  }
}

class Ejemplar {
  constructor(idEjemplar, codigoBarras, codigoMaterial, estanteUbicacion, condicionFisica = "Óptimo", nombreEstado = "Disponible") {
    this.idEjemplar = idEjemplar;
    this.codigoBarras = codigoBarras;
    this.codigoMaterial = codigoMaterial;
    this.estanteUbicacion = estanteUbicacion;
    this.condicionFisica = condicionFisica;
    this.estadoActual = Ejemplar.crearInstanciaEstado(nombreEstado);
  }

  static crearInstanciaEstado(nombre) {
    if (nombre === "Reservado") return new EstadoEjemplarReservado();
    if (nombre === "Prestado") return new EstadoEjemplarPrestado();
    if (nombre === "En Reparación") return new EstadoEjemplarEnReparacion();
    return new EstadoEjemplarDisponible();
  }

  cambiarEstado(nuevoEstado) {
    this.estadoActual = nuevoEstado;
  }

  getNombreEstado() { return this.estadoActual.getNombre(); }
  getCssClassEstado() { return this.estadoActual.getCssClass(); }

  reservar() { return this.estadoActual.reservar(this); }
  liberarPorCancelacion() { return this.estadoActual.liberarPorCancelacion(this); }
  entregarEnPrestamo() { return this.estadoActual.entregarEnPrestamo(this); }
  registrarDevolucion(condicion) { return this.estadoActual.registrarDevolucion(this, condicion); }
  enviarAReparacion() { return this.estadoActual.enviarAReparacion(this); }
  finalizarReparacion() { return this.estadoActual.finalizarReparacion(this); }

  // Transición dirigida desde el selector de Gestión de Ejemplares respetando el Patrón State
  cambiarCondicionPorNombre(nuevoEstadoNombre) {
    if (nuevoEstadoNombre === "Disponible") {
      if (this.getNombreEstado() === "En Reparación") return this.finalizarReparacion();
      if (this.getNombreEstado() === "Prestado") return this.registrarDevolucion("BUEN_ESTADO");
      return this.liberarPorCancelacion();
    }
    if (nuevoEstadoNombre === "Reservado") return this.reservar();
    if (nuevoEstadoNombre === "Prestado") return this.entregarEnPrestamo();
    if (nuevoEstadoNombre === "En Reparación") return this.enviarAReparacion();
    return { exito: false, mensaje: "Estado físico no reconocido en el catálogo parametrizable." };
  }
}

class MaterialBibliografico {
  constructor(codigo, titulo, autor, categoria = "Ingeniería de Software", descripcion = "", ejemplares = []) {
    this.codigo = codigo;
    this.titulo = titulo;
    this.autor = autor;
    this.categoria = categoria;
    this.descripcion = descripcion;
    this.ejemplares = ejemplares;
    this.estado = "Disponible";
    this.sincronizarEstadoGeneral();
  }

  sincronizarEstadoGeneral() {
    if (!this.ejemplares || this.ejemplares.length === 0) {
      this.estado = "Disponible";
      return;
    }
    const estados = this.ejemplares.map(e => e.getNombreEstado());
    if (estados.includes("Disponible")) {
      this.estado = "Disponible";
    } else if (estados.includes("Reservado")) {
      this.estado = "Reservado";
    } else if (estados.includes("Prestado")) {
      this.estado = "Prestado";
    } else {
      this.estado = "En Reparación";
    }
  }
}

class Reserva {
  constructor(idReserva, cliente, material, ejemplar, fechaReserva, fechaEntrega, estadoInicial = null, fechaSolicitud = "2026-11-18") {
    this.idReserva = idReserva;
    this.cliente = cliente;
    this.material = material;
    this.ejemplar = ejemplar;
    this.fechaSolicitud = fechaSolicitud;
    this.fechaReserva = fechaReserva;
    this.fechaEntrega = fechaEntrega;
    this.estadoActual = estadoInicial || new EstadoPendiente();
  }

  static crearInstanciaEstado(nombre) {
    if (nombre === "CONFIRMADA") return new EstadoConfirmada();
    if (nombre === "FINALIZADA") return new EstadoFinalizada();
    if (nombre === "CANCELADA") return new EstadoCancelada();
    return new EstadoPendiente();
  }

  cambiarEstado(nuevoEstado) {
    this.estadoActual = nuevoEstado;
  }

  aprobar() { return this.estadoActual.aprobar(this); }
  cancelar() { return this.estadoActual.cancelar(this); }
  finalizar(condicionEjemplar) { return this.estadoActual.finalizar(this, condicionEjemplar); }
  editarReserva(nuevaFechaInicio, nuevaFechaEntrega, hayConflicto) {
    return this.estadoActual.editarReserva(this, nuevaFechaInicio, nuevaFechaEntrega, hayConflicto);
  }

  getNombreEstado() { return this.estadoActual.getNombre(); }
  getCssClassEstado() { return this.estadoActual.getCssClass(); }
}

class Reporte {
  constructor(idReporte, tipo, titulo, filasDatos, columnas) {
    this.idReporte = idReporte;
    this.fechaGeneracion = new Date().toLocaleString("es-CO");
    this.tipo = tipo;
    this.titulo = titulo;
    this.filasDatos = filasDatos;
    this.columnas = columnas;
  }

  exportarCSV() {
    if (!this.filasDatos || this.filasDatos.length === 0) return null;
    const header = this.columnas.join(";");
    const rows = this.filasDatos.map(fila => fila.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"));
    return "\uFEFF" + [header, ...rows].join("\r\n");
  }
}

// ============================================================================
// 5. CONTROLADOR PRINCIPAL DE LA APLICACIÓN (SIGREB APP)
// ============================================================================
class BibliotecaApp {
  constructor() {
    this.STORAGE_KEY = "SIGREB_ITM_STATE_DB_V2";

    // Colecciones en memoria sincronizadas con localStorage
    this.clientes = [];
    this.staff = [];
    this.materiales = [];
    this.ejemplares = [];
    this.reservas = [];
    this.logs = [];

    // Estado de Sesión y Seguridad
    this.usuarioActual = null; // null o instancia de Usuario, o { rol: 'Visitante' }
    this.intentosFallidosLogin = 0;
    this.bloqueoLoginActivo = false;
    this.segundosRestantesSesion = 15 * 60; // 15 minutos (HU-002 CA-01)
    this.intervaloSesion = null;
    this.simularFalloRedNotificacion = false;

    // Variables operativas de UI
    this.reservaSeleccionadaId = null;
    this.reservaIdPendienteCancelar = null;
    this.reservaIdPendienteDevolucion = null;
    this.reporteActual = null;

    this.inicializarPersistencia();
    this.cacheDOM();
    this.bindEvents();
    this.iniciarDetectorActividad();
    this.renderTerminalLogs();
  }

  // --------------------------------------------------------------------------
  // PERSISTENCIA EN LOCALSTORAGE Y DATOS SEMILLA REALISTAS
  // --------------------------------------------------------------------------
  inicializarPersistencia() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.hidratarDesdeJSON(data);
        return;
      } catch (e) {
        console.warn("Error leyendo localStorage, cargando semilla inicial...", e);
      }
    }
    this.cargarDatosSemilla();
    this.guardarEnLocalStorage();
  }

  cargarDatosSemilla() {
    // 1. Clientes con Patrón State (Activo, En Morosidad, Inactivo)
    this.clientes = [
      new Cliente(1, "1001234567", "Juan Pablo Zuluaga Salazar", "juanzuluaga@itm.edu.co", hashPassword("1234"), false, 0, null, true, "Activo"),
      new Cliente(2, "1009876543", "Samuel Machado Estrada", "samuelmachado@itm.edu.co", hashPassword("1234"), false, 0, null, true, "Activo"),
      new Cliente(3, "1005554433", "Josué Asprilla Palacios", "josueasprilla@itm.edu.co", hashPassword("1234"), true, 15000, "2026-12-15", true, "En Morosidad"),
      new Cliente(4, "1007778899", "Laura Gómez Restrepo", "lauragomez@itm.edu.co", hashPassword("1234"), false, 0, null, false, "Inactivo")
    ];

    // 2. Personal Bibliotecario y Administrador
    this.staff = [
      new Bibliotecario(10, "2001112233", "Carlos Andrés Mejía", "carlosmejia.biblio@itm.edu.co", hashPassword("biblio123"), "Turno Mañana"),
      new Administrador(99, "9001112233", "Willian Díaz Villegas", "williandiaz.admin@itm.edu.co", hashPassword("admin123"))
    ];

    // 3. Ejemplares físicos con Patrón State (EstadoMaterial)
    const ej1 = new Ejemplar(1001, "EJ-1001", "LIB-001", "Estante A-01", "Óptimo", "Reservado");
    const ej2 = new Ejemplar(1002, "EJ-1002", "LIB-001", "Estante A-01", "Óptimo", "Disponible");
    const ej3 = new Ejemplar(1003, "EJ-1003", "LIB-002", "Estante B-03", "Óptimo", "Reservado");
    const ej4 = new Ejemplar(1004, "EJ-1004", "LIB-002", "Estante B-03", "Óptimo", "Disponible");
    const ej5 = new Ejemplar(1005, "EJ-1005", "LIB-003", "Estante B-04", "Óptimo", "Disponible");
    const ej6 = new Ejemplar(1006, "EJ-1006", "LIB-004", "Estante C-02", "En préstamo activo", "Prestado");
    const ej7 = new Ejemplar(1007, "EJ-1007", "LIB-005", "Estante D-01", "Encuadernación suelta", "En Reparación");
    const ej8 = new Ejemplar(1008, "EJ-1008", "LIB-006", "Estante A-03", "Óptimo", "Disponible");

    this.ejemplares = [ej1, ej2, ej3, ej4, ej5, ej6, ej7, ej8];

    // 4. Catálogo de Materiales Bibliográficos
    this.materiales = [
      new MaterialBibliografico("LIB-001", "Cien Años de Soledad", "Gabriel García Márquez", "Literatura", "Obra maestra del realismo mágico latinoamericano.", [ej1, ej2]),
      new MaterialBibliografico("LIB-002", "Clean Code: Manual de Estilo para el Desarrollo Ágil", "Robert C. Martin", "Ingeniería de Software", "Principios, patrones y prácticas para escribir código limpio y mantenible.", [ej3, ej4]),
      new MaterialBibliografico("LIB-003", "Patrones de Diseño (Design Patterns GoF)", "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides", "Arquitectura y Diseño", "Catálogo clásico de 23 patrones de diseño orientados a objetos (incluye Patrón State).", [ej5]),
      new MaterialBibliografico("LIB-004", "Fundamentos de Bases de Datos (7ma Edición)", "Abraham Silberschatz, Henry F. Korth", "Bases de Datos", "Modelado relacional, normalización SQL, transacciones y control de concurrencia.", [ej6]),
      new MaterialBibliografico("LIB-005", "Cálculo de una Variable: Trascendentes Tempranas", "James Stewart", "Ciencias Básicas", "Texto guía de cálculo diferencial e integral para ingeniería.", [ej7]),
      new MaterialBibliografico("LIB-006", "UML y Patrones: Introducción al Análisis y Diseño OO", "Craig Larman", "Arquitectura y Diseño", "Diagramas de clases, secuencia, estados y principios GRASP.", [ej8])
    ];

    // 5. Reservas con Patrón State (EstadoReserva)
    this.reservas = [
      new Reserva(101, this.clientes[0], this.materiales[0], ej1, "2026-11-19", "2026-11-23", new EstadoConfirmada(), "2026-11-17"),
      new Reserva(102, this.clientes[1], this.materiales[1], ej3, "2026-11-20", "2026-11-24", new EstadoPendiente(), "2026-11-18"),
      new Reserva(103, this.clientes[0], this.materiales[2], ej5, "2026-11-05", "2026-11-09", new EstadoFinalizada(), "2026-11-04"),
      new Reserva(104, this.clientes[2], this.materiales[3], ej6, "2026-11-10", "2026-11-14", new EstadoConfirmada(), "2026-11-09")
    ];

    this.reservaSeleccionadaId = 101;

    const hora = new Date().toTimeString().split(" ")[0];
    this.logs = [
      { time: hora, tipo: "info", msg: "SIGREB ITM iniciado. Persistencia localStorage sincronizada con las 3 máquinas de estado (Reserva, Ejemplar, Cliente)." },
      { time: hora, tipo: "success", msg: "Reserva #101 cargada en estado CONFIRMADA (Ejemplar EJ-1001 Reservado)." },
      { time: hora, tipo: "warning", msg: "Alerta de Morosidad: Cliente Josué Asprilla (1005554433) presenta estado 'En Morosidad' ($15.000 COP) por reserva vencida #104." }
    ];
  }

  guardarEnLocalStorage() {
    const payload = {
      clientes: this.clientes.map(c => ({
        idUsuario: c.idUsuario,
        documento: c.documento,
        nombre: c.nombre,
        email: c.email,
        contrasenaHash: c.contrasenaHash,
        estadoSancion: c.estadoSancion,
        morosidad: c.morosidad,
        fechaFinSancion: c.fechaFinSancion,
        estado: c.estado,
        nombreEstadoCliente: c.getNombreEstadoCliente()
      })),
      staff: this.staff.map(s => ({
        idUsuario: s.idUsuario,
        documento: s.documento,
        nombre: s.nombre,
        email: s.email,
        contrasenaHash: s.contrasenaHash,
        rol: s.rol,
        turno: s.turno
      })),
      ejemplares: this.ejemplares.map(e => ({
        idEjemplar: e.idEjemplar,
        codigoBarras: e.codigoBarras,
        codigoMaterial: e.codigoMaterial,
        estanteUbicacion: e.estanteUbicacion,
        condicionFisica: e.condicionFisica,
        nombreEstado: e.getNombreEstado()
      })),
      materiales: this.materiales.map(m => ({
        codigo: m.codigo,
        titulo: m.titulo,
        autor: m.autor,
        categoria: m.categoria,
        descripcion: m.descripcion
      })),
      reservas: this.reservas.map(r => ({
        idReserva: r.idReserva,
        clienteDoc: r.cliente.documento,
        materialCod: r.material.codigo,
        ejemplarId: r.ejemplar ? r.ejemplar.idEjemplar : null,
        fechaSolicitud: r.fechaSolicitud,
        fechaReserva: r.fechaReserva,
        fechaEntrega: r.fechaEntrega,
        nombreEstado: r.getNombreEstado()
      })),
      logs: this.logs
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  }

  hidratarDesdeJSON(data) {
    this.clientes = data.clientes.map(c => new Cliente(
      c.idUsuario, c.documento, c.nombre, c.email, c.contrasenaHash,
      c.estadoSancion, c.morosidad, c.fechaFinSancion, c.estado, c.nombreEstadoCliente
    ));

    this.staff = data.staff.map(s => {
      if (s.rol === "Administrador") {
        return new Administrador(s.idUsuario, s.documento, s.nombre, s.email, s.contrasenaHash);
      }
      return new Bibliotecario(s.idUsuario, s.documento, s.nombre, s.email, s.contrasenaHash, s.turno);
    });

    this.ejemplares = data.ejemplares.map(e => new Ejemplar(
      e.idEjemplar, e.codigoBarras, e.codigoMaterial, e.estanteUbicacion, e.condicionFisica, e.nombreEstado
    ));

    this.materiales = data.materiales.map(m => {
      const copias = this.ejemplares.filter(e => e.codigoMaterial === m.codigo);
      return new MaterialBibliografico(m.codigo, m.titulo, m.autor, m.categoria, m.descripcion, copias);
    });

    this.reservas = data.reservas.map(r => {
      const cli = this.clientes.find(c => c.documento === r.clienteDoc) || this.clientes[0];
      const mat = this.materiales.find(m => m.codigo === r.materialCod) || this.materiales[0];
      const ej = this.ejemplares.find(e => e.idEjemplar === r.ejemplarId) || mat.ejemplares[0];
      const estadoObj = Reserva.crearInstanciaEstado(r.nombreEstado);
      return new Reserva(r.idReserva, cli, mat, ej, r.fechaReserva, r.fechaEntrega, estadoObj, r.fechaSolicitud);
    });

    this.logs = Array.isArray(data.logs) ? data.logs : [];
    this.reservaSeleccionadaId = this.reservas.length > 0 ? this.reservas[0].idReserva : null;
  }

  // --------------------------------------------------------------------------
  // CACHÉ DE ELEMENTOS DOM Y ENLACE DE EVENTOS
  // --------------------------------------------------------------------------
  cacheDOM() {
    // Vistas principales y Barra Superior
    this.viewAuth = document.getElementById("view-auth");
    this.viewApp = document.getElementById("view-app");
    this.toastContainer = document.getElementById("toast-container");
    this.sessionTimerBox = document.getElementById("session-timer-box");
    this.sessionTimerDisplay = document.getElementById("session-timer-display");
    this.userBadgeBox = document.getElementById("user-badge-box");
    this.currentRoleBadge = document.getElementById("current-role-badge");
    this.currentUserName = document.getElementById("current-user-name");
    this.currentUserDoc = document.getElementById("current-user-doc");
    this.btnLogout = document.getElementById("btn-logout");
    this.btnResetSeed = document.getElementById("btn-reset-seed");
    this.btnSimularInactividad = document.getElementById("btn-simular-inactividad");

    // Login
    this.formLogin = document.getElementById("form-login");
    this.inputLoginDoc = document.getElementById("login-documento");
    this.inputLoginPass = document.getElementById("login-password");
    this.lblLoginAttempts = document.getElementById("login-attempts-count");
    this.alertLoginLock = document.getElementById("login-lock-alert");
    this.lblLockCountdown = document.getElementById("lock-countdown");
    this.btnLoginSubmit = document.getElementById("btn-login-submit");
    this.btnAccesoVisitante = document.getElementById("btn-acceso-visitante");

    // Navegación por Rol
    this.navGroupCliente = document.getElementById("nav-group-cliente");
    this.navGroupStaff = document.getElementById("nav-group-staff");
    this.lblPanelCliente = document.getElementById("lbl-panel-cliente");
    this.lblPanelStaff = document.getElementById("lbl-panel-staff");
    this.tabMisReservas = document.getElementById("tab-mis-reservas");
    this.tabMiPerfil = document.getElementById("tab-mi-perfil");
    this.badgeCountMisReservas = document.getElementById("badge-count-mis-reservas");
    this.visitorBanner = document.getElementById("visitor-banner");
    this.btnVisitorGoLogin = document.getElementById("btn-visitor-go-login");

    // Catálogo Bibliográfico
    this.catSearchQuery = document.getElementById("cat-search-query");
    this.catFilterCategoria = document.getElementById("cat-filter-categoria");
    this.catFilterEstado = document.getElementById("cat-filter-estado");
    this.catFilterFecha = document.getElementById("cat-filter-fecha");
    this.btnCatLimpiar = document.getElementById("btn-cat-limpiar");
    this.catalogoGrid = document.getElementById("catalogo-grid");
    this.catalogoEmptyMsg = document.getElementById("catalogo-empty-msg");

    // Mis Reservas
    this.misResSearchCodigo = document.getElementById("mis-res-search-codigo");
    this.misResFilterEstado = document.getElementById("mis-res-filter-estado");
    this.tbodyMisReservas = document.getElementById("tbody-mis-reservas");

    // Inspector del Patrón State (Gestión de Reservas)
    this.selectReserva = document.getElementById("select-reserva");
    this.lblId = document.getElementById("res-id");
    this.lblCliente = document.getElementById("cli-nombre");
    this.lblDoc = document.getElementById("cli-doc");
    this.lblSancion = document.getElementById("cli-sancion");
    this.lblTitulo = document.getElementById("mat-titulo");
    this.lblCodigo = document.getElementById("mat-codigo");
    this.lblEjemplar = document.getElementById("mat-ejemplar");
    this.lblFechasDetalle = document.getElementById("res-fechas-detalle");
    this.lblMatEstado = document.getElementById("mat-estado");
    this.badgeReserva = document.getElementById("reserva-badge");

    this.btnAprobar = document.getElementById("btn-aprobar");
    this.btnEditarInspector = document.getElementById("btn-editar-inspector");
    this.btnCancelar = document.getElementById("btn-cancelar");
    this.btnFinalizar = document.getElementById("btn-finalizar");

    // Filtros y Tabla Gestión de Reservas
    this.admResFilterEstado = document.getElementById("adm-res-filter-estado");
    this.admResFilterCliente = document.getElementById("adm-res-filter-cliente");
    this.admResFilterMaterial = document.getElementById("adm-res-filter-material");
    this.admResFilterFecha = document.getElementById("adm-res-filter-fecha");
    this.btnAdmResLimpiar = document.getElementById("btn-adm-res-limpiar");
    this.tbodyGestionReservas = document.getElementById("tbody-gestion-reservas");
    this.admReservasCount = document.getElementById("adm-reservas-count");
    this.btnAbrirModalPresencial = document.getElementById("btn-abrir-modal-presencial");

    // Gestión de Ejemplares
    this.ejSearchQuery = document.getElementById("ej-search-query");
    this.ejFilterEstado = document.getElementById("ej-filter-estado");
    this.tbodyGestionEjemplares = document.getElementById("tbody-gestion-ejemplares");

    // Gestión de Clientes
    this.cliSearchQuery = document.getElementById("cli-search-query");
    this.cliFilterEstado = document.getElementById("cli-filter-estado");
    this.tbodyGestionClientes = document.getElementById("tbody-gestion-clientes");

    // Gestión de Catálogo y CSV
    this.formNuevoLibro = document.getElementById("form-nuevo-libro");
    this.csvFileInput = document.getElementById("csv-file-input");
    this.csvRawTextarea = document.getElementById("csv-raw-textarea");
    this.btnProcesarCsv = document.getElementById("btn-procesar-csv");
    this.btnCargarEjemploCsv = document.getElementById("btn-cargar-ejemplo-csv");
    this.csvImportResults = document.getElementById("csv-import-results");

    // Reportes y Terminal de Logs
    this.repTipo = document.getElementById("rep-tipo");
    this.repFiltroEstado = document.getElementById("rep-filtro-estado");
    this.repFiltroQuery = document.getElementById("rep-filtro-query");
    this.btnGenerarReporte = document.getElementById("btn-generar-reporte");
    this.btnExportCsv = document.getElementById("btn-export-csv");
    this.btnExportPdf = document.getElementById("btn-export-pdf");
    this.reporteEmptyMsg = document.getElementById("reporte-empty-msg");
    this.reportePreviewContainer = document.getElementById("reporte-preview-container");
    this.logTerminal = document.getElementById("log-terminal");
    this.btnClearLog = document.getElementById("btn-clear-log");
    this.btnSimularFalloNotif = document.getElementById("btn-simular-fallo-notif");
    this.btnSimularInconsistencia = document.getElementById("btn-simular-inconsistencia");
  }

  bindEvents() {
    // 1. Login y Cuentas Semilla de 1 Clic
    this.formLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      this.procesarLogin(this.inputLoginDoc.value.trim(), this.inputLoginPass.value);
    });

    document.querySelectorAll(".demo-user-item").forEach(item => {
      item.addEventListener("click", () => {
        const doc = item.getAttribute("data-doc");
        const pass = item.getAttribute("data-pass");
        this.inputLoginDoc.value = doc;
        this.inputLoginPass.value = pass;
        this.procesarLogin(doc, pass);
      });
    });

    this.btnAccesoVisitante.addEventListener("click", () => this.entrarComoVisitante());
    this.btnVisitorGoLogin.addEventListener("click", () => this.cerrarSesion());
    this.btnLogout.addEventListener("click", () => this.cerrarSesion());

    this.btnResetSeed.addEventListener("click", () => {
      localStorage.removeItem(this.STORAGE_KEY);
      this.cargarDatosSemilla();
      this.guardarEnLocalStorage();
      this.refrescarTodasLasVistas();
      this.mostrarToast("Datos semilla restaurados correctamente en localStorage.", "success");
    });

    this.btnSimularInactividad.addEventListener("click", () => {
      this.segundosRestantesSesion = 0;
      this.verificarExpiracionInactividad();
    });

    // 2. Navegación por Pestañas (con control de acceso por rol)
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-target");
        this.cambiarPestana(targetId, tab);
      });
    });

    // 3. Filtros Instantáneos del Catálogo (< 2s)
    [this.catSearchQuery, this.catFilterCategoria, this.catFilterEstado, this.catFilterFecha].forEach(el => {
      el.addEventListener("input", () => this.renderCatalogo());
      el.addEventListener("change", () => this.renderCatalogo());
    });

    this.btnCatLimpiar.addEventListener("click", () => {
      this.catSearchQuery.value = "";
      this.catFilterCategoria.value = "TODAS";
      this.catFilterEstado.value = "TODOS";
      this.catFilterFecha.value = "";
      this.renderCatalogo();
    });

    // 4. Filtros de Mis Reservas
    [this.misResSearchCodigo, this.misResFilterEstado].forEach(el => {
      el.addEventListener("input", () => this.renderMisReservas());
      el.addEventListener("change", () => this.renderMisReservas());
    });

    // 5. Inspector Polimórfico de Reserva (Patrón State)
    this.selectReserva.addEventListener("change", (e) => {
      this.reservaSeleccionadaId = parseInt(e.target.value, 10);
      this.actualizarDetalleVistaInspector();
      this.log(`Inspector State: Seleccionada Reserva #${this.reservaSeleccionadaId}`, "info");
    });

    this.btnAprobar.addEventListener("click", () => {
      if (this.reservaSeleccionadaId) this.accionAprobarReserva(this.reservaSeleccionadaId);
    });
    this.btnEditarInspector.addEventListener("click", () => {
      if (this.reservaSeleccionadaId) this.abrirModalEditarFecha(this.reservaSeleccionadaId);
    });
    this.btnFinalizar.addEventListener("click", () => {
      if (this.reservaSeleccionadaId) this.abrirModalFinalizarDevolucion(this.reservaSeleccionadaId);
    });
    this.btnCancelar.addEventListener("click", () => {
      if (this.reservaSeleccionadaId) this.abrirModalConfirmarCancelacion(this.reservaSeleccionadaId);
    });

    // 6. Filtros Gestión de Reservas (Bibliotecario / Administrador - HU-005)
    [this.admResFilterEstado, this.admResFilterCliente, this.admResFilterMaterial, this.admResFilterFecha].forEach(el => {
      el.addEventListener("input", () => this.renderGestionReservas());
      el.addEventListener("change", () => this.renderGestionReservas());
    });

    this.btnAdmResLimpiar.addEventListener("click", () => {
      this.admResFilterEstado.value = "TODAS";
      this.admResFilterCliente.value = "";
      this.admResFilterMaterial.value = "";
      this.admResFilterFecha.value = "";
      this.renderGestionReservas();
    });

    this.btnAbrirModalPresencial.addEventListener("click", () => this.abrirModalReservaPresencial());

    // 7. Filtros Gestión de Ejemplares y Clientes
    [this.ejSearchQuery, this.ejFilterEstado].forEach(el => {
      el.addEventListener("input", () => this.renderGestionEjemplares());
      el.addEventListener("change", () => this.renderGestionEjemplares());
    });

    [this.cliSearchQuery, this.cliFilterEstado].forEach(el => {
      el.addEventListener("input", () => this.renderGestionClientes());
      el.addEventListener("change", () => this.renderGestionClientes());
    });

    // 8. Gestión de Catálogo y Sincronización CSV/XLSX
    this.formNuevoLibro.addEventListener("submit", (e) => {
      e.preventDefault();
      this.registrarNuevoMaterialCatalogo();
    });

    this.csvFileInput.addEventListener("change", (e) => this.leerArchivoCsvSubido(e));
    this.btnProcesarCsv.addEventListener("click", () => this.procesarImportacionCSV());
    this.btnCargarEjemploCsv.addEventListener("click", () => {
      this.csvRawTextarea.value = [
        "LIB-008;Domain-Driven Design;Eric Evans;Ingeniería de Software;Estante A-04;Diseño guiado por el dominio",
        "FILA_CORRUPTA_SIN_COLUMNAS_VALIDAS",
        "LIB-009;El Coronel No Tiene Quien Le Escriba;Gabriel García Márquez;Literatura;Estante B-02;Clásico de literatura colombiana",
        "LIB-010;Sistemas Operativos Modernos;;Ciencias Básicas;Estante D-01;Fila con autor vacío (inválida)"
      ].join("\n");
    });

    // 9. Reportes y Terminal de Logs
    this.btnGenerarReporte.addEventListener("click", () => this.generarReporteActual());
    this.repTipo.addEventListener("change", () => this.generarReporteActual());
    this.btnExportCsv.addEventListener("click", () => this.descargarReporteCSV());
    this.btnExportPdf.addEventListener("click", () => this.imprimirReportePDF());

    this.btnClearLog.addEventListener("click", () => {
      this.logs = [];
      this.guardarEnLocalStorage();
      this.renderTerminalLogs();
      this.mostrarToast("Registros de la terminal de eventos limpiados.", "info");
    });

    this.btnSimularFalloNotif.addEventListener("click", () => {
      this.simularFalloRedNotificacion = !this.simularFalloRedNotificacion;
      const estadoTxt = this.simularFalloRedNotificacion ? "ACTIVADA (Fallo de envío ➔ Pendiente de reintento)" : "DESACTIVADA (Envío normal)";
      this.btnSimularFalloNotif.textContent = this.simularFalloRedNotificacion
        ? "⚡ Simulación Fallo Red: ON"
        : "⚡ Simular Fallo Red Notificación";
      this.log(`Tolerancia a fallos de notificaciones: Simulación ${estadoTxt}`, "warning");
      this.mostrarToast(`Simulación de fallo de notificación: ${estadoTxt}`, "warning");
    });

    this.btnSimularInconsistencia.addEventListener("click", () => this.simularInconsistenciaMaterial());

    // 10. Eventos de Modales
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close");
        document.getElementById(modalId).classList.add("hidden");
      });
    });

    // Validación en vivo de fecha ocupada en modal Solicitar Reserva (HU-002 / HU-003)
    const inputModalInicio = document.getElementById("modal-res-fecha-inicio");
    const inputModalEntrega = document.getElementById("modal-res-fecha-entrega");
    const selectModalEjemplar = document.getElementById("modal-res-ejemplar");
    [inputModalInicio, inputModalEntrega, selectModalEjemplar].forEach(el => {
      el.addEventListener("change", () => this.validarDisponibilidadEnModalReserva());
    });

    document.getElementById("form-solicitar-reserva").addEventListener("submit", (e) => {
      e.preventDefault();
      this.confirmarSolicitudReservaWeb();
    });

    document.getElementById("form-reserva-presencial").addEventListener("submit", (e) => {
      e.preventDefault();
      this.confirmarReservaPresencial();
    });

    document.getElementById("btn-ejecutar-cancelacion").addEventListener("click", () => {
      this.ejecutarCancelacionConfirmada();
    });

    document.getElementById("btn-ejecutar-devolucion").addEventListener("click", () => {
      this.ejecutarDevolucionConfirmada();
    });

    document.getElementById("form-editar-fecha").addEventListener("submit", (e) => {
      e.preventDefault();
      this.guardarEdicionFechaReserva();
    });

    document.getElementById("form-cambiar-estado-ejemplar").addEventListener("submit", (e) => {
      e.preventDefault();
      this.confirmarCambioEstadoEjemplar();
    });

    // 11. Registro / Creación de Nuevos Usuarios (Desde Login o desde Gestión de Clientes)
    const btnAbrirRegistroLogin = document.getElementById("btn-abrir-registro");
    if (btnAbrirRegistroLogin) {
      btnAbrirRegistroLogin.addEventListener("click", () => this.abrirModalRegistrarUsuario("LOGIN"));
    }

    const btnAbrirNuevoClienteAdmin = document.getElementById("btn-abrir-modal-nuevo-cliente");
    if (btnAbrirNuevoClienteAdmin) {
      btnAbrirNuevoClienteAdmin.addEventListener("click", () => this.abrirModalRegistrarUsuario("ADMIN"));
    }

    const formRegistrarUsuario = document.getElementById("form-registrar-usuario");
    if (formRegistrarUsuario) {
      formRegistrarUsuario.addEventListener("submit", (e) => {
        e.preventDefault();
        this.procesarRegistroNuevoUsuario();
      });
    }
  }

  // --------------------------------------------------------------------------
  // CREACIÓN / REGISTRO DE NUEVOS USUARIOS Y CLIENTES (FIGURA 9.1.3 UML)
  // --------------------------------------------------------------------------
  abrirModalRegistrarUsuario(origen = "LOGIN") {
    this.origenRegistroUsuario = origen;
    const form = document.getElementById("form-registrar-usuario");
    if (form) form.reset();

    const alertBox = document.getElementById("modal-registro-alert");
    if (alertBox) alertBox.className = "alert hidden";

    const selectEstadoInicial = document.getElementById("reg-estado-inicial");
    if (selectEstadoInicial) {
      selectEstadoInicial.value = "Activo";
      // Si se registra desde el login público, nace siempre Activo según Figura 9.1.3
      selectEstadoInicial.disabled = (origen === "LOGIN");
    }

    document.getElementById("modal-registrar-usuario").classList.remove("hidden");
  }

  procesarRegistroNuevoUsuario() {
    const doc = document.getElementById("reg-documento").value.trim();
    const rol = document.getElementById("reg-rol").value;
    const nombre = document.getElementById("reg-nombre").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const rawPass = document.getElementById("reg-password").value;
    const estadoInicial = document.getElementById("reg-estado-inicial").value || "Activo";
    const alertBox = document.getElementById("modal-registro-alert");

    if (!doc || !nombre || !email || rawPass.length < 4) {
      alertBox.textContent = "Complete todos los campos obligatorios. La contraseña debe tener al menos 4 caracteres.";
      alertBox.className = "alert alert-warning";
      return;
    }

    const todosUsuarios = [...this.clientes, ...this.staff];
    if (todosUsuarios.some(u => u.documento === doc)) {
      const msgDup = `Ya existe un usuario registrado con la cédula/documento ${doc}.`;
      alertBox.textContent = msgDup;
      alertBox.className = "alert alert-danger";
      this.mostrarToast(msgDup, "error");
      this.log(`Registro Usuario rechazado: Documento duplicado [${doc}].`, "rejected");
      return;
    }

    const passHash = hashPassword(rawPass);
    const nextId = todosUsuarios.length > 0 ? Math.max(...todosUsuarios.map(u => u.idUsuario)) + 1 : 1;
    let nuevoUsuario = null;

    if (rol === "Cliente") {
      const esMoroso = (estadoInicial === "En Morosidad");
      const estaActiva = (estadoInicial !== "Inactivo");
      const montoMora = esMoroso ? 15000 : 0;
      const fechaSancion = esMoroso ? "2026-12-20" : null;

      nuevoUsuario = new Cliente(
        nextId,
        doc,
        nombre,
        email,
        passHash,
        esMoroso,
        montoMora,
        fechaSancion,
        estaActiva,
        estadoInicial
      );
      this.clientes.push(nuevoUsuario);
    } else if (rol === "Bibliotecario") {
      nuevoUsuario = new Bibliotecario(nextId, doc, nombre, email, passHash, "Turno General");
      this.staff.push(nuevoUsuario);
    } else {
      nuevoUsuario = new Administrador(nextId, doc, nombre, email, passHash);
      this.staff.push(nuevoUsuario);
    }

    this.guardarEnLocalStorage();
    this.agregarUsuarioATarjetaDemoLogin(nuevoUsuario, rawPass);
    this.refrescarTodasLasVistas();

    document.getElementById("modal-registrar-usuario").classList.add("hidden");
    this.log(`Nuevo usuario registrado: ${nombre} (C.C. ${doc}) con rol [${rol}]${rol === "Cliente" ? ` en estado inicial '${nuevoUsuario.getNombreEstadoCliente()}'` : ""}.`, "success");
    this.mostrarToast(`Usuario ${nombre} (${rol}) creado exitosamente.`, "success");

    // Si lo creó desde la pantalla de Login, autocompletar sus credenciales para entrar de inmediato
    if (this.origenRegistroUsuario === "LOGIN") {
      this.inputLoginDoc.value = doc;
      this.inputLoginPass.value = rawPass;
      if (rol !== "Cliente" || nuevoUsuario.getNombreEstadoCliente() !== "Inactivo") {
        this.procesarLogin(doc, rawPass);
      }
    }
  }

  agregarUsuarioATarjetaDemoLogin(usuario, rawPass) {
    const listaDemo = document.querySelector(".demo-users-list");
    if (!listaDemo) return;

    let borderClass = "role-border-cliente";
    let pillClass = "pill-cliente";
    let labelRol = `${usuario.rol.toUpperCase()}`;

    if (usuario.rol === "Cliente") {
      const est = usuario.getNombreEstadoCliente();
      labelRol = `CLIENTE (${est})`;
      if (est === "En Morosidad") { borderClass = "role-border-moroso"; pillClass = "pill-moroso"; }
      else if (est === "Inactivo") { borderClass = "role-border-inactivo"; pillClass = "pill-inactivo"; }
    } else if (usuario.rol === "Bibliotecario") {
      borderClass = "role-border-biblio";
      pillClass = "pill-biblio";
    } else if (usuario.rol === "Administrador") {
      borderClass = "role-border-admin";
      pillClass = "pill-admin";
    }

    const item = document.createElement("div");
    item.className = `demo-user-item ${borderClass}`;
    item.setAttribute("data-doc", usuario.documento);
    item.setAttribute("data-pass", rawPass);
    item.innerHTML = `
      <div class="demo-user-info">
        <span class="role-pill ${pillClass}">${labelRol} · NUEVO</span>
        <strong>${usuario.nombre}</strong>
        <small>C.C. ${usuario.documento} · Clave: ${rawPass}</small>
      </div>
      <button class="btn btn-secondary btn-sm">Usar</button>
    `;

    item.addEventListener("click", () => {
      this.inputLoginDoc.value = usuario.documento;
      this.inputLoginPass.value = rawPass;
      this.procesarLogin(usuario.documento, rawPass);
    });

    listaDemo.prepend(item);
  }

  // --------------------------------------------------------------------------
  // AUTENTICACIÓN, BLOQUEO TRAS 3 INTENTOS E INACTIVIDAD (15 MINUTOS)
  // --------------------------------------------------------------------------
  procesarLogin(documento, password) {
    if (this.bloqueoLoginActivo) {
      this.mostrarToast("Acceso bloqueado temporalmente por superar 3 intentos fallidos.", "error");
      return;
    }

    const todosUsuarios = [...this.clientes, ...this.staff];
    const usuario = todosUsuarios.find(u => u.documento === documento);

    if (!usuario || !usuario.iniciarSesion(password)) {
      this.intentosFallidosLogin++;
      this.lblLoginAttempts.textContent = this.intentosFallidosLogin;
      this.log(`Intento de inicio de sesión fallido (${this.intentosFallidosLogin}/3) para documento [${documento || "vacío"}].`, "rejected");

      if (this.intentosFallidosLogin >= 3) {
        this.activarBloqueoTemporalLogin();
      } else {
        this.mostrarToast(`Credenciales inválidas. Intento ${this.intentosFallidosLogin} de 3.`, "error");
      }
      return;
    }

    // Validar si es un Cliente en estado Inactivo (Patrón State Cliente)
    if (usuario.rol === "Cliente" && usuario.getNombreEstadoCliente() === "Inactivo") {
      this.log(`Acceso denegado: El cliente ${usuario.nombre} (${usuario.documento}) tiene la cuenta INACTIVA.`, "rejected");
      this.mostrarToast("Su cuenta se encuentra INACTIVA por administración. Contacte al Administrador.", "error");
      return;
    }

    // Login Exitoso
    this.intentosFallidosLogin = 0;
    this.lblLoginAttempts.textContent = "0";
    this.usuarioActual = usuario;
    this.iniciarTemporizadorInactividad();

    this.log(`Inicio de sesión exitoso: ${usuario.nombre} [Rol identificado: ${usuario.rol}].`, "success");
    this.mostrarToast(`Bienvenido(a), ${usuario.nombre} (${usuario.rol})`, "success");
    this.configurarInterfazPorRol();
  }

  activarBloqueoTemporalLogin() {
    this.bloqueoLoginActivo = true;
    this.alertLoginLock.classList.remove("hidden");
    this.btnLoginSubmit.disabled = true;
    this.log("Seguridad: Bloqueo temporal activado tras 3 intentos fallidos de inicio de sesión.", "rejected");
    this.mostrarToast("Bloqueo Temporal: Ha superado los 3 intentos fallidos de inicio de sesión.", "error");

    let segundos = 30;
    this.lblLockCountdown.textContent = segundos;
    const timer = setInterval(() => {
      segundos--;
      this.lblLockCountdown.textContent = segundos;
      if (segundos <= 0) {
        clearInterval(timer);
        this.bloqueoLoginActivo = false;
        this.intentosFallidosLogin = 0;
        this.lblLoginAttempts.textContent = "0";
        this.alertLoginLock.classList.add("hidden");
        this.btnLoginSubmit.disabled = false;
        this.log("Seguridad: Bloqueo temporal de inicio de sesión finalizado.", "info");
      }
    }, 1000);
  }

  entrarComoVisitante() {
    this.usuarioActual = {
      idUsuario: 0,
      documento: "PÚBLICO",
      nombre: "Usuario Visitante",
      email: "visitante@itm.edu.co",
      rol: "Visitante"
    };
    this.detenerTemporizadorInactividad();
    this.log("Acceso público: Usuario ingresó en modo Visitante (solo consulta de catálogo).", "info");
    this.mostrarToast("Modo Visitante activado: Puedes consultar el catálogo y disponibilidad en tiempo real.", "info");
    this.configurarInterfazPorRol();
  }

  cerrarSesion(motivo = "Sesión cerrada correctamente.") {
    if (this.usuarioActual) {
      this.log(`Cierre de sesión: ${this.usuarioActual.nombre} (${this.usuarioActual.rol}). Motivo: ${motivo}`, "info");
    }
    this.usuarioActual = null;
    this.detenerTemporizadorInactividad();

    this.viewApp.classList.add("hidden");
    this.viewAuth.classList.remove("hidden");
    this.userBadgeBox.classList.add("hidden");
    this.btnLogout.classList.add("hidden");
    this.sessionTimerBox.classList.add("hidden");
    this.inputLoginPass.value = "";
  }

  iniciarDetectorActividad() {
    ["click", "keydown", "mousemove", "change"].forEach(evt => {
      document.addEventListener(evt, () => {
        if (this.usuarioActual && this.usuarioActual.rol !== "Visitante") {
          this.segundosRestantesSesion = 15 * 60;
        }
      });
    });
  }

  iniciarTemporizadorInactividad() {
    this.detenerTemporizadorInactividad();
    this.segundosRestantesSesion = 15 * 60;
    this.sessionTimerBox.classList.remove("hidden");
    this.actualizarDisplayTemporizador();

    this.intervaloSesion = setInterval(() => {
      this.segundosRestantesSesion--;
      this.actualizarDisplayTemporizador();
      this.verificarExpiracionInactividad();
    }, 1000);
  }

  detenerTemporizadorInactividad() {
    if (this.intervaloSesion) {
      clearInterval(this.intervaloSesion);
      this.intervaloSesion = null;
    }
    this.sessionTimerBox.classList.add("hidden");
  }

  actualizarDisplayTemporizador() {
    const min = Math.floor(Math.max(0, this.segundosRestantesSesion) / 60);
    const seg = Math.max(0, this.segundosRestantesSesion) % 60;
    this.sessionTimerDisplay.textContent = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  }

  verificarExpiracionInactividad() {
    if (this.segundosRestantesSesion <= 0 && this.usuarioActual) {
      this.mostrarToast("Sesión cerrada automáticamente tras 15 minutos de inactividad (HU-002 CA-01).", "warning");
      this.cerrarSesion("Expiración automática por 15 minutos de inactividad");
    }
  }

  // --------------------------------------------------------------------------
  // CONFIGURACIÓN DEL MAPA DE NAVEGACIÓN SEGÚN ROL
  // --------------------------------------------------------------------------
  configurarInterfazPorRol() {
    this.viewAuth.classList.add("hidden");
    this.viewApp.classList.remove("hidden");
    this.userBadgeBox.classList.remove("hidden");
    this.btnLogout.classList.remove("hidden");

    const rol = this.usuarioActual.rol;
    this.currentUserName.textContent = this.usuarioActual.nombre;
    this.currentUserDoc.textContent = `Doc: ${this.usuarioActual.documento}`;
    this.currentRoleBadge.textContent = rol.toUpperCase();

    this.currentRoleBadge.className = "role-pill";
    if (rol === "Cliente") this.currentRoleBadge.classList.add("pill-cliente");
    else if (rol === "Bibliotecario") this.currentRoleBadge.classList.add("pill-biblio");
    else if (rol === "Administrador") this.currentRoleBadge.classList.add("pill-admin");
    else this.currentRoleBadge.classList.add("pill-visitante");

    // Configurar visibilidad de paneles
    if (rol === "Visitante") {
      this.navGroupCliente.classList.remove("hidden");
      this.navGroupStaff.classList.add("hidden");
      this.lblPanelCliente.textContent = "PORTAL PÚBLICO (VISITANTE)";
      this.tabMisReservas.classList.add("hidden");
      this.tabMiPerfil.classList.add("hidden");
      this.visitorBanner.classList.remove("hidden");
      this.activarSeccion("sec-catalogo");
    } else if (rol === "Cliente") {
      this.navGroupCliente.classList.remove("hidden");
      this.navGroupStaff.classList.add("hidden");
      this.lblPanelCliente.textContent = "PANEL DEL CLIENTE";
      this.tabMisReservas.classList.remove("hidden");
      this.tabMiPerfil.classList.remove("hidden");
      this.visitorBanner.classList.add("hidden");
      this.activarSeccion("sec-catalogo");
    } else if (rol === "Bibliotecario" || rol === "Administrador") {
      // Bibliotecario y Administrador ven el panel operativo + acceso de consulta al catálogo
      this.navGroupCliente.classList.remove("hidden");
      this.navGroupStaff.classList.remove("hidden");
      this.lblPanelCliente.textContent = "CONSULTA CATÁLOGO";
      this.tabMisReservas.classList.add("hidden");
      this.tabMiPerfil.classList.add("hidden");
      this.visitorBanner.classList.add("hidden");
      this.lblPanelStaff.textContent = rol === "Administrador"
        ? "PANEL DEL ADMINISTRADOR (HEREDA BIBLIOTECARIO + AUDITORÍA)"
        : "PANEL DEL BIBLIOTECARIO";
      this.activarSeccion("sec-dashboard");
    }

    this.refrescarTodasLasVistas();
  }

  cambiarPestana(targetId, tabElement) {
    const rol = this.usuarioActual ? this.usuarioActual.rol : "Visitante";
    const modulosStaff = [
      "sec-dashboard",
      "sec-gestion-reservas",
      "sec-gestion-ejemplares",
      "sec-gestion-clientes",
      "sec-gestion-catalogo",
      "sec-reportes-logs"
    ];

    if (modulosStaff.includes(targetId) && rol !== "Bibliotecario" && rol !== "Administrador") {
      this.mostrarToast("Privilegios Insuficientes: Su perfil no cuenta con permisos para este módulo", "error");
      this.log(`Control de Acceso: Perfil [${rol}] intentó acceder sin autorización a [${targetId}].`, "rejected");
      return;
    }

    if ((targetId === "sec-mis-reservas" || targetId === "sec-mi-perfil") && rol === "Visitante") {
      this.mostrarToast("Privilegios Insuficientes: Su perfil no cuenta con permisos para este módulo", "error");
      return;
    }

    this.activarSeccion(targetId, tabElement);
  }

  activarSeccion(targetId, tabElement = null) {
    document.querySelectorAll(".module-section").forEach(sec => sec.classList.add("hidden"));
    const targetSec = document.getElementById(targetId);
    if (targetSec) targetSec.classList.remove("hidden");

    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    if (tabElement) {
      tabElement.classList.add("active");
    } else {
      const matchingTab = document.querySelector(`.nav-tab[data-target="${targetId}"]`);
      if (matchingTab) matchingTab.classList.add("active");
    }
  }

  refrescarTodasLasVistas() {
    this.renderCatalogo();
    this.renderMisReservas();
    this.renderMiPerfil();
    this.renderDashboard();
    this.renderSelectorReservas();
    this.actualizarDetalleVistaInspector();
    this.renderGestionReservas();
    this.renderGestionEjemplares();
    this.renderGestionClientes();
    this.generarReporteActual();
    this.renderTerminalLogs();
  }

  // --------------------------------------------------------------------------
  // MÓDULO A1: CATÁLOGO BIBLIOGRÁFICO Y DISPONIBILIDAD POR FECHA (HU-002/003)
  // --------------------------------------------------------------------------
  evaluarDisponibilidadMaterialEnFecha(material, fechaConsultada) {
    material.sincronizarEstadoGeneral();

    // Si no se especificó fecha, retornar disponibilidad física general
    if (!fechaConsultada) {
      const disponibles = material.ejemplares.filter(e => e.getNombreEstado() === "Disponible");
      if (disponibles.length > 0) {
        return {
          estadoTexto: "Disponible",
          cssClass: "status-disponible",
          puedeReservar: true,
          detalle: `${disponibles.length} de ${material.ejemplares.length} ejemplar(es) disponible(s) hoy.`
        };
      }
      // Si no hay disponibles hoy, buscar fecha estimada de devolución en reservas activas
      const reservaActiva = this.reservas.find(
        r => r.material.codigo === material.codigo &&
        (r.getNombreEstado() === "CONFIRMADA" || r.getNombreEstado() === "PENDIENTE")
      );
      const fechaDevolucion = reservaActiva ? reservaActiva.fechaEntrega : "2026-11-25";

      if (material.estado === "Prestado") {
        return {
          estadoTexto: "No disponible (prestado)",
          cssClass: "status-prestado",
          puedeReservar: false,
          detalle: `Préstamo activo. Fecha estimada de devolución: ${fechaDevolucion} (HU-003 CA-02).`
        };
      }
      if (material.estado === "Reservado") {
        return {
          estadoTexto: "Reservado",
          cssClass: "status-reservado",
          puedeReservar: false,
          detalle: `Reserva activa hasta: ${fechaDevolucion}.`
        };
      }
      return {
        estadoTexto: "En Reparación",
        cssClass: "status-reparacion",
        puedeReservar: false,
        detalle: "Ejemplar en restauración física."
      };
    }

    // Cuando el usuario consulta una fecha específica (HU-003 CA-01, CA-02, CA-03, CA-04)
    const ejemplaresHabiles = material.ejemplares.filter(e => e.getNombreEstado() !== "En Reparación");
    if (ejemplaresHabiles.length === 0) {
      return {
        estadoTexto: "No disponible (En Reparación)",
        cssClass: "status-reparacion",
        puedeReservar: false,
        detalle: "Ningún ejemplar apto para préstamo en esa fecha."
      };
    }

    // Verificar si al menos un ejemplar hábil está libre en la fecha consultada
    let ejemplarLibreEnFecha = null;
    let conflictoReserva = null;

    for (const ej of ejemplaresHabiles) {
      const reservaCruza = this.reservas.find(r =>
        r.ejemplar &&
        r.ejemplar.idEjemplar === ej.idEjemplar &&
        (r.getNombreEstado() === "PENDIENTE" || r.getNombreEstado() === "CONFIRMADA") &&
        fechaConsultada >= r.fechaReserva &&
        fechaConsultada <= r.fechaEntrega
      );
      if (!reservaCruza && ej.getNombreEstado() !== "Prestado") {
        ejemplarLibreEnFecha = ej;
        break;
      } else if (reservaCruza) {
        conflictoReserva = reservaCruza;
      }
    }

    if (ejemplarLibreEnFecha) {
      return {
        estadoTexto: "Disponible",
        cssClass: "status-disponible",
        puedeReservar: true,
        detalle: `Disponible para el ${fechaConsultada} (Ejemplar ${ejemplarLibreEnFecha.codigoBarras}).`
      };
    }

    if (material.estado === "Prestado") {
      const fDev = conflictoReserva ? conflictoReserva.fechaEntrega : "2026-11-25";
      return {
        estadoTexto: "No disponible (prestado)",
        cssClass: "status-prestado",
        puedeReservar: false,
        detalle: `En préstamo activo. Fecha estimada de devolución: ${fDev} (HU-003 CA-02).`
      };
    }

    return {
      estadoTexto: "Reservado para esa fecha",
      cssClass: "status-reservado",
      puedeReservar: false,
      detalle: `Fecha No Disponible: El ejemplar ya se encuentra reservado hasta ${conflictoReserva ? conflictoReserva.fechaEntrega : fechaConsultada} (HU-003 CA-03).`
    };
  }

  renderCatalogo() {
    const query = (this.catSearchQuery.value || "").trim().toLowerCase();
    const categoria = this.catFilterCategoria.value;
    const estadoFiltro = this.catFilterEstado.value;
    const fechaConsultada = this.catFilterFecha.value;

    const filtrados = this.materiales.filter(mat => {
      mat.sincronizarEstadoGeneral();
      const coincideTexto = !query ||
        mat.titulo.toLowerCase().includes(query) ||
        mat.autor.toLowerCase().includes(query) ||
        mat.codigo.toLowerCase().includes(query) ||
        mat.categoria.toLowerCase().includes(query);

      const coincideCat = categoria === "TODAS" || mat.categoria === categoria;
      const coincideEst = estadoFiltro === "TODOS" || mat.estado === estadoFiltro;

      return coincideTexto && coincideCat && coincideEst;
    });

    this.catalogoGrid.innerHTML = "";

    // RNF Usabilidad: Mensaje exacto si no hay coincidencias
    if (filtrados.length === 0) {
      this.catalogoEmptyMsg.classList.remove("hidden");
      return;
    }
    this.catalogoEmptyMsg.classList.add("hidden");

    const rol = this.usuarioActual ? this.usuarioActual.rol : "Visitante";

    filtrados.forEach(mat => {
      const infoDisp = this.evaluarDisponibilidadMaterialEnFecha(mat, fechaConsultada);
      const card = document.createElement("div");
      card.className = "book-card";

      const listaEjemplaresHtml = mat.ejemplares.map(e =>
        `<div>• <code>${e.codigoBarras}</code> (${e.estanteUbicacion}) ➔ <span class="tag-status ${e.getCssClassEstado()}">${e.getNombreEstado()}</span></div>`
      ).join("");

      let botonAccionHtml = "";
      if (rol === "Visitante") {
        botonAccionHtml = `<button class="btn btn-secondary btn-block" disabled title="Inicie sesión como Cliente para reservar">🔒 Inicia sesión para reservar</button>`;
      } else if ( infoDisp.puedeReservar ) {
        botonAccionHtml = `<button class="btn btn-primary btn-block btn-solicitar-res" data-codigo="${mat.codigo}">📅 Solicitar Reserva</button>`;
      } else {
        botonAccionHtml = `<button class="btn btn-secondary btn-block" disabled>🚫 No Disponible para Reservar</button>`;
      }

      card.innerHTML = `
        <div>
          <div class="book-card-header">
            <span class="book-code">${mat.codigo}</span>
            <span class="tag-status ${infoDisp.cssClass}">${infoDisp.estadoTexto}</span>
          </div>
          <h3 class="book-title">${mat.titulo}</h3>
          <p class="book-author">✍️ ${mat.autor}</p>
          <span class="book-category">🏷️ ${mat.categoria}</span>
          <p class="book-desc">${mat.descripcion}</p>
        </div>
        <div>
          <div class="book-copies-box">
            <p><strong>Estado de Disponibilidad:</strong> ${infoDisp.detalle}</p>
            ${listaEjemplaresHtml}
          </div>
          ${botonAccionHtml}
        </div>
      `;

      const btnRes = card.querySelector(".btn-solicitar-res");
      if (btnRes) {
        btnRes.addEventListener("click", () => this.abrirModalSolicitarReserva(mat.codigo));
      }

      this.catalogoGrid.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // FLUJO MODAL: SOLICITAR RESERVA VÍA WEB (HU-002 y HU-003)
  // --------------------------------------------------------------------------
  abrirModalSolicitarReserva(codigoMaterial) {
    if (!this.usuarioActual || this.usuarioActual.rol === "Visitante") {
      this.mostrarToast("Debe iniciar sesión para solicitar una reserva.", "error");
      return;
    }

    const mat = this.materiales.find(m => m.codigo === codigoMaterial);
    if (!mat) return;

    document.getElementById("modal-res-codigo").value = mat.codigo;
    document.getElementById("modal-res-book-info").innerHTML = `
      <p><strong>Material:</strong> [${mat.codigo}] ${mat.titulo}</p>
      <p><strong>Autor:</strong> ${mat.autor} · <strong>Categoría:</strong> ${mat.categoria}</p>
    `;

    // Poblar selector de ejemplares físicos
    const selectEj = document.getElementById("modal-res-ejemplar");
    selectEj.innerHTML = "";
    mat.ejemplares.forEach(ej => {
      const opt = document.createElement("option");
      opt.value = ej.idEjemplar;
      opt.textContent = `${ej.codigoBarras} - ${ej.estanteUbicacion} [${ej.getNombreEstado()}]`;
      selectEj.appendChild(opt);
    });

    const fFiltro = this.catFilterFecha.value || "2026-11-25";
    const inputInicio = document.getElementById("modal-res-fecha-inicio");
    const inputEntrega = document.getElementById("modal-res-fecha-entrega");
    inputInicio.value = fFiltro;
    inputEntrega.value = this.sumarDiasFecha(fFiltro, 3);

    this.validarDisponibilidadEnModalReserva();
    document.getElementById("modal-solicitar-reserva").classList.remove("hidden");
  }

  sumarDiasFecha(fechaISO, dias) {
    const d = new Date(fechaISO + "T12:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().split("T")[0];
  }

  verificarConflictoFechasEjemplar(idEjemplar, fechaInicio, fechaFin, excluirReservaId = null) {
    return this.reservas.some(r => {
      if (excluirReservaId && r.idReserva === excluirReservaId) return false;
      if (!r.ejemplar || r.ejemplar.idEjemplar !== idEjemplar) return false;
      const est = r.getNombreEstado();
      if (est !== "PENDIENTE" && est !== "CONFIRMADA") return false;
      return (fechaInicio <= r.fechaEntrega && fechaFin >= r.fechaReserva);
    });
  }

  validarDisponibilidadEnModalReserva() {
    const alertBox = document.getElementById("modal-res-alert");
    const inputInicio = document.getElementById("modal-res-fecha-inicio");
    const inputEntrega = document.getElementById("modal-res-fecha-entrega");
    const selectEj = document.getElementById("modal-res-ejemplar");
    const btnConfirmar = document.getElementById("btn-confirmar-solicitud-res");

    inputInicio.classList.remove("input-conflict-error");
    inputEntrega.classList.remove("input-conflict-error");
    alertBox.className = "alert hidden";
    btnConfirmar.disabled = false;

    // 1. Validar sanción o morosidad del cliente autenticado (Patrón State Cliente)
    if (this.usuarioActual && this.usuarioActual.rol === "Cliente") {
      const validacionCli = this.usuarioActual.validarPermisoReserva();
      if (!validacionCli.permitido) {
        alertBox.textContent = validacionCli.mensaje;
        alertBox.className = "alert alert-danger";
        btnConfirmar.disabled = true;
        return false;
      }
    }

    const idEjemplar = parseInt(selectEj.value, 10);
    const fInicio = inputInicio.value;
    const fEntrega = inputEntrega.value;

    if (!fInicio || !fEntrega || fEntrega < fInicio) {
      alertBox.textContent = "La fecha de entrega debe ser igual o posterior a la fecha de reserva.";
      alertBox.className = "alert alert-warning";
      btnConfirmar.disabled = true;
      return false;
    }

    // 2. Validar conflicto de fechas sobre el ejemplar (RNF Disponibilidad - Errores)
    const ej = this.ejemplares.find(e => e.idEjemplar === idEjemplar);
    const hayConflicto = this.verificarConflictoFechasEjemplar(idEjemplar, fInicio, fEntrega);

    if (hayConflicto || (ej && ej.getNombreEstado() === "En Reparación")) {
      inputInicio.classList.add("input-conflict-error");
      inputEntrega.classList.add("input-conflict-error");
      alertBox.textContent = "Fecha No Disponible: El ejemplar ya se encuentra reservado para este periodo";
      alertBox.className = "alert alert-danger";
      btnConfirmar.disabled = true;
      return false;
    }

    alertBox.textContent = "✔️ Ejemplar y periodo disponibles. Puede confirmar su solicitud de reserva.";
    alertBox.className = "alert alert-success";
    return true;
  }

  confirmarSolicitudReservaWeb() {
    if (!this.validarDisponibilidadEnModalReserva()) {
      this.log("Bloqueo de Reserva Web: Validación de sanción o conflicto de fechas impidió el registro.", "rejected");
      return;
    }

    const codigoMat = document.getElementById("modal-res-codigo").value;
    const idEjemplar = parseInt(document.getElementById("modal-res-ejemplar").value, 10);
    const fInicio = document.getElementById("modal-res-fecha-inicio").value;
    const fEntrega = document.getElementById("modal-res-fecha-entrega").value;

    const mat = this.materiales.find(m => m.codigo === codigoMat);
    const ej = this.ejemplares.find(e => e.idEjemplar === idEjemplar);
    const clienteReserva = this.usuarioActual.rol === "Cliente" ? this.usuarioActual : this.clientes[0];

    // Transición del Ejemplar a 'Reservado' (HU-002 CA-05)
    ej.reservar();
    mat.sincronizarEstadoGeneral();

    const nuevoId = this.reservas.length > 0 ? Math.max(...this.reservas.map(r => r.idReserva)) + 1 : 101;
    const hoyISO = new Date().toISOString().split("T")[0];
    const nuevaReserva = new Reserva(nuevoId, clienteReserva, mat, ej, fInicio, fEntrega, new EstadoPendiente(), hoyISO);

    this.reservas.push(nuevaReserva);
    this.reservaSeleccionadaId = nuevoId;
    this.guardarEnLocalStorage();

    document.getElementById("modal-solicitar-reserva").classList.add("hidden");
    this.log(`HU-002: Reserva #${nuevoId} creada en estado PENDIENTE por ${clienteReserva.nombre}. Ejemplar [${ej.codigoBarras}] pasa a 'Reservado'.`, "success");
    this.enviarNotificacionAutomatica(clienteReserva, `Confirmación de Solicitud de Reserva #${nuevoId} (${mat.titulo})`);

    this.refrescarTodasLasVistas();
    this.mostrarComprobanteReservaModal(nuevaReserva, "✅ Reserva Registrada con Éxito (HU-002 CA-04)");
  }

  // --------------------------------------------------------------------------
  // MÓDULO A2: MIS RESERVAS Y CANCELACIÓN CON CONFIRMACIÓN EXPLÍCITA (HU-004)
  // --------------------------------------------------------------------------
  renderMisReservas() {
    if (!this.usuarioActual || this.usuarioActual.rol !== "Cliente") {
      this.badgeCountMisReservas.textContent = "0";
      return;
    }

    const docActual = this.usuarioActual.documento;
    const misReservasTotal = this.reservas.filter(r => r.cliente.documento === docActual);
    this.badgeCountMisReservas.textContent = misReservasTotal.length;

    const queryCod = (this.misResSearchCodigo.value || "").trim().toLowerCase();
    const estadoFiltro = this.misResFilterEstado.value;

    const filtradas = misReservasTotal.filter(r => {
      const coincideCod = !queryCod ||
        r.material.codigo.toLowerCase().includes(queryCod) ||
        r.material.titulo.toLowerCase().includes(queryCod);
      const coincideEst = estadoFiltro === "TODAS" || r.getNombreEstado() === estadoFiltro;
      return coincideCod && coincideEst;
    });

    this.tbodyMisReservas.innerHTML = "";
    if (filtradas.length === 0) {
      this.tbodyMisReservas.innerHTML = `<tr><td colspan="8" style="text-align:center;">No se encontraron reservas asociadas con los criterios seleccionados.</td></tr>`;
      return;
    }

    filtradas.forEach(r => {
      const est = r.getNombreEstado();
      const puedeCancelar = est === "PENDIENTE" || est === "CONFIRMADA";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${r.idReserva}</strong></td>
        <td><code>${r.material.codigo}</code> - ${r.material.titulo}</td>
        <td><code>${r.ejemplar ? r.ejemplar.codigoBarras : "N/A"}</code></td>
        <td>${r.fechaSolicitud}</td>
        <td>${r.fechaReserva}</td>
        <td>${r.fechaEntrega}</td>
        <td><span class="badge-estado ${r.getCssClassEstado()}">${est}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs btn-ver-res" data-id="${r.idReserva}">🔍 Ver Detalle</button>
            ${puedeCancelar
              ? `<button class="btn btn-danger btn-xs btn-cancel-res" data-id="${r.idReserva}">❌ Cancelar Reserva</button>`
              : `<button class="btn btn-secondary btn-xs" disabled>Sin acciones</button>`}
          </div>
        </td>
      `;

      tr.querySelector(".btn-ver-res").addEventListener("click", () => this.mostrarComprobanteReservaModal(r));
      const btnCancel = tr.querySelector(".btn-cancel-res");
      if (btnCancel) {
        btnCancel.addEventListener("click", () => this.abrirModalConfirmarCancelacion(r.idReserva));
      }

      this.tbodyMisReservas.appendChild(tr);
    });
  }

  abrirModalConfirmarCancelacion(idReserva) {
    const r = this.reservas.find(res => res.idReserva === idReserva);
    if (!r) return;

    this.reservaIdPendienteCancelar = idReserva;
    document.getElementById("modal-cancel-detalle").innerHTML = `
      <p><strong>ID Reserva:</strong> #${r.idReserva} (${r.getNombreEstado()})</p>
      <p><strong>Cliente:</strong> ${r.cliente.nombre} (C.C. ${r.cliente.documento})</p>
      <p><strong>Material:</strong> [${r.material.codigo}] ${r.material.titulo}</p>
      <p><strong>Ejemplar Físico:</strong> ${r.ejemplar ? r.ejemplar.codigoBarras : "N/A"}</p>
      <p><strong>Periodo Reservado:</strong> ${r.fechaReserva} al ${r.fechaEntrega}</p>
    `;
    document.getElementById("modal-confirmar-cancelacion").classList.remove("hidden");
  }

  ejecutarCancelacionConfirmada() {
    if (!this.reservaIdPendienteCancelar) return;
    const r = this.reservas.find(res => res.idReserva === this.reservaIdPendienteCancelar);
    document.getElementById("modal-confirmar-cancelacion").classList.add("hidden");
    if (!r) return;

    const res = r.cancelar();
    this.guardarEnLocalStorage();
    this.refrescarTodasLasVistas();

    if (res.exito) {
      this.log(`HU-004: ${res.mensaje}`, "success");
      this.enviarNotificacionAutomatica(r.cliente, `Cancelación de Reserva #${r.idReserva} (${r.material.titulo})`);
      this.mostrarToast(res.mensaje, "success");
    } else {
      this.log(res.mensaje, "rejected");
      this.mostrarToast(res.mensaje, "error");
    }
  }

  // --------------------------------------------------------------------------
  // MÓDULO A3: MI PERFIL
  // --------------------------------------------------------------------------
  renderMiPerfil() {
    if (!this.usuarioActual || this.usuarioActual.rol !== "Cliente") return;
    const c = this.usuarioActual;

    document.getElementById("perfil-nombre").textContent = c.nombre;
    document.getElementById("perfil-documento").textContent = c.documento;
    document.getElementById("perfil-email").textContent = c.email;
    document.getElementById("perfil-rol").textContent = c.rol;

    const nombreEst = c.getNombreEstadoCliente();
    const badgeEst = document.getElementById("perfil-estado-badge");
    badgeEst.textContent = nombreEst.toUpperCase();
    badgeEst.className = `tag-status ${c.getCssClassEstadoCliente()}`;

    document.getElementById("perfil-estado-cuenta").textContent = nombreEst;
    const flagSancion = document.getElementById("perfil-sancion-flag");
    flagSancion.textContent = c.estadoSancion ? "TRUE (Sanción Activa)" : "FALSE (Sin Sanción)";
    flagSancion.className = `tag-status ${c.estadoSancion ? "status-moroso" : "status-clean"}`;

    document.getElementById("perfil-morosidad-valor").textContent = `$${c.morosidad.toLocaleString("es-CO")} COP`;
    document.getElementById("perfil-sancion-fecha").textContent = c.fechaFinSancion || "Sin sanción vigente";

    const alertaSancion = document.getElementById("perfil-alerta-sancion");
    if (c.estadoSancion) {
      alertaSancion.classList.remove("hidden");
      alertaSancion.textContent = `Error de Validación: El usuario presenta una sanción activa hasta ${c.fechaFinSancion || "2026-12-15"}. Sus solicitudes de reserva están bloqueadas hasta regularizar la mora.`;
    } else {
      alertaSancion.classList.add("hidden");
    }
  }

  // --------------------------------------------------------------------------
  // MÓDULO B1: DASHBOARD GENERAL Y AUDITORÍA DE INCONSISTENCIAS (HU-005 CA-03)
  // --------------------------------------------------------------------------
  renderDashboard() {
    const totalRes = this.reservas.length;
    const resPendientes = this.reservas.filter(r => r.getNombreEstado() === "PENDIENTE").length;
    const resConfirmadas = this.reservas.filter(r => r.getNombreEstado() === "CONFIRMADA").length;
    const resFinalizadas = this.reservas.filter(r => r.getNombreEstado() === "FINALIZADA").length;
    const resCanceladas = this.reservas.filter(r => r.getNombreEstado() === "CANCELADA").length;

    const ejDisp = this.ejemplares.filter(e => e.getNombreEstado() === "Disponible").length;
    const ejRes = this.ejemplares.filter(e => e.getNombreEstado() === "Reservado").length;
    const ejPres = this.ejemplares.filter(e => e.getNombreEstado() === "Prestado").length;
    const ejRep = this.ejemplares.filter(e => e.getNombreEstado() === "En Reparación").length;

    const cliActivos = this.clientes.filter(c => c.getNombreEstadoCliente() === "Activo").length;
    const cliMorosos = this.clientes.filter(c => c.getNombreEstadoCliente() === "En Morosidad").length;
    const cliInactivos = this.clientes.filter(c => c.getNombreEstadoCliente() === "Inactivo").length;

    const kpiGrid = document.getElementById("dashboard-kpi-grid");
    kpiGrid.innerHTML = `
      <div class="kpi-card kpi-blue">
        <div class="kpi-title">Total Reservas</div>
        <div class="kpi-value">${totalRes}</div>
        <div class="kpi-sub">🟡 ${resPendientes} Pendientes · 🟢 ${resConfirmadas} Confirmadas</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-title">Ejemplares Físicos (${this.ejemplares.length})</div>
        <div class="kpi-value">${ejDisp} Libres</div>
        <div class="kpi-sub">🟡 ${ejRes} Reservados · 🟣 ${ejPres} Prestados · 🟠 ${ejRep} Reparación</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-title">Clientes y Morosidad</div>
        <div class="kpi-value">${cliMorosos} En Mora</div>
        <div class="kpi-sub">🟢 ${cliActivos} Activos · ⚪ ${cliInactivos} Inactivos</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-title">Títulos en Catálogo</div>
        <div class="kpi-value">${this.materiales.length}</div>
        <div class="kpi-sub">Finalizadas: ${resFinalizadas} · Canceladas: ${resCanceladas}</div>
      </div>
    `;

    // Auditoría de Inconsistencias (HU-005 CA-03: Material marcado como reservado sin registro de reserva activo)
    this.renderAuditoriaInconsistencias();

    // Ranking de Libros Más Prestados / Reservados
    const topContenedor = document.getElementById("dashboard-top-libros");
    const conteoPorLibro = this.materiales.map(m => {
      const cantidad = this.reservas.filter(r => r.material.codigo === m.codigo).length;
      return { material: m, cantidad };
    }).sort((a, b) => b.cantidad - a.cantidad);

    topContenedor.innerHTML = conteoPorLibro.map((item, idx) => `
      <div class="top-book-item">
        <div>
          <strong>#${idx + 1} [${item.material.codigo}] ${item.material.titulo}</strong>
          <div class="text-muted">${item.material.autor} · ${item.material.categoria}</div>
        </div>
        <span class="tag-status status-disponible">${item.cantidad} préstamo(s)/reserva(s)</span>
      </div>
    `).join("");

    // Resumen de Estados del Patrón State
    document.getElementById("dashboard-state-summary").innerHTML = `
      <div class="summary-card">
        <p><strong>1. Máquina de Estados Reserva:</strong> Pendientes (${resPendientes}) | Confirmadas (${resConfirmadas}) | Finalizadas (${resFinalizadas}) | Canceladas (${resCanceladas})</p>
      </div>
      <div class="summary-card">
        <p><strong>2. Máquina de Estados Ejemplar:</strong> Disponibles (${ejDisp}) | Reservados (${ejRes}) | Prestados (${ejPres}) | En Reparación (${ejRep})</p>
      </div>
      <div class="summary-card">
        <p><strong>3. Máquina de Estados Cliente:</strong> Activos (${cliActivos}) | En Morosidad (${cliMorosos}) | Inactivos (${cliInactivos})</p>
      </div>
    `;
  }

  renderAuditoriaInconsistencias() {
    const contenedor = document.getElementById("inconsistencias-content");
    const ejemplaresInconsistentes = this.ejemplares.filter(ej => {
      if (ej.getNombreEstado() !== "Reservado") return false;
      const tieneReservaActiva = this.reservas.some(r =>
        r.ejemplar &&
        r.ejemplar.idEjemplar === ej.idEjemplar &&
        (r.getNombreEstado() === "PENDIENTE" || r.getNombreEstado() === "CONFIRMADA")
      );
      return !tieneReservaActiva;
    });

    if (ejemplaresInconsistentes.length === 0) {
      contenedor.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:0;">
          ✅ <strong>Integridad Verificada (HU-005 CA-03):</strong> No se detectaron inconsistencias. Todos los ejemplares marcados como 'Reservado' cuentan con su respectivo registro de reserva activa.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = ejemplaresInconsistentes.map(ej => `
      <div class="alert alert-danger" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong>🚨 Alerta de Inconsistencia Detectada (HU-005 CA-03):</strong> El ejemplar <code>${ej.codigoBarras}</code> (Libro <code>${ej.codigoMaterial}</code>) está marcado como <strong>Reservado</strong> sin un registro de reserva activo asociado.
        </div>
        <button class="btn btn-success btn-sm btn-corregir-inconsistencia" data-id="${ej.idEjemplar}">🔧 Liberar a Disponible</button>
      </div>
    `).join("");

    contenedor.querySelectorAll(".btn-corregir-inconsistencia").forEach(btn => {
      btn.addEventListener("click", () => {
        const idEj = parseInt(btn.getAttribute("data-id"), 10);
        const ej = this.ejemplares.find(e => e.idEjemplar === idEj);
        if (ej) {
          ej.liberarPorCancelacion();
          const mat = this.materiales.find(m => m.codigo === ej.codigoMaterial);
          if (mat) mat.sincronizarEstadoGeneral();
          this.guardarEnLocalStorage();
          this.log(`Auditoría HU-005 CA-03: Inconsistencia corregida en ejemplar [${ej.codigoBarras}]. Pasa a 'Disponible'.`, "success");
          this.mostrarToast(`Inconsistencia corregida: Ejemplar ${ej.codigoBarras} liberado a Disponible.`, "success");
          this.refrescarTodasLasVistas();
        }
      });
    });
  }

  simularInconsistenciaMaterial() {
    const ejDisp = this.ejemplares.find(e => e.getNombreEstado() === "Disponible");
    if (!ejDisp) {
      this.mostrarToast("No hay ejemplares Disponibles en este momento para simular inconsistencia.", "warning");
      return;
    }
    ejDisp.reservar();
    this.guardarEnLocalStorage();
    this.log(`HU-005 CA-03: Simulada inconsistencia en ejemplar [${ejDisp.codigoBarras}] (marcado como 'Reservado' sin reserva activa).`, "warning");
    this.mostrarToast(`Alerta HU-005 CA-03: Ejemplar ${ejDisp.codigoBarras} marcado como Reservado sin reserva activa.`, "warning");
    this.refrescarTodasLasVistas();
  }

  // --------------------------------------------------------------------------
  // MÓDULO B2: GESTIÓN DE RESERVAS + INSPECTOR PATRÓN STATE + HU-001
  // --------------------------------------------------------------------------
  renderSelectorReservas() {
    if (!this.selectReserva) return;
    this.selectReserva.innerHTML = "";
    this.reservas.forEach(r => {
      const option = document.createElement("option");
      option.value = r.idReserva;
      option.textContent = `Reserva #${r.idReserva} - ${r.material.titulo} [${r.getNombreEstado()}]`;
      if (r.idReserva === this.reservaSeleccionadaId) option.selected = true;
      this.selectReserva.appendChild(option);
    });
  }

  actualizarDetalleVistaInspector() {
    const r = this.reservas.find(res => res.idReserva === this.reservaSeleccionadaId) || this.reservas[0];
    if (!r) return;

    this.reservaSeleccionadaId = r.idReserva;
    this.lblId.textContent = `#${r.idReserva}`;
    this.lblCliente.textContent = r.cliente.nombre;
    this.lblDoc.textContent = r.cliente.documento;

    const estCli = r.cliente.getNombreEstadoCliente();
    this.lblSancion.textContent = r.cliente.estadoSancion ? `${estCli} (SANCIONADO)` : `${estCli} (Sin Sanción)`;
    this.lblSancion.className = `tag-status ${r.cliente.getCssClassEstadoCliente()}`;

    this.lblTitulo.textContent = r.material.titulo;
    this.lblCodigo.textContent = r.material.codigo;
    this.lblEjemplar.textContent = r.ejemplar ? `${r.ejemplar.codigoBarras} (${r.ejemplar.estanteUbicacion})` : "N/A";
    this.lblFechasDetalle.textContent = `${r.fechaReserva} al ${r.fechaEntrega}`;

    const estEj = r.ejemplar ? r.ejemplar.getNombreEstado() : r.material.estado;
    const cssEj = r.ejemplar ? r.ejemplar.getCssClassEstado() : "status-disponible";
    this.lblMatEstado.textContent = estEj;
    this.lblMatEstado.className = `tag-status ${cssEj}`;

    this.badgeReserva.textContent = r.getNombreEstado();
    this.badgeReserva.className = `badge-estado ${r.getCssClassEstado()}`;
  }

  renderGestionReservas() {
    const fEstado = this.admResFilterEstado.value;
    const fCliente = (this.admResFilterCliente.value || "").trim().toLowerCase();
    const fMaterial = (this.admResFilterMaterial.value || "").trim().toLowerCase();
    const fFecha = this.admResFilterFecha.value;

    const filtradas = this.reservas.filter(r => {
      const okEst = fEstado === "TODAS" || r.getNombreEstado() === fEstado;
      const okCli = !fCliente ||
        r.cliente.nombre.toLowerCase().includes(fCliente) ||
        r.cliente.documento.toLowerCase().includes(fCliente);
      const okMat = !fMaterial ||
        r.material.codigo.toLowerCase().includes(fMaterial) ||
        r.material.titulo.toLowerCase().includes(fMaterial);
      const okFec = !fFecha || r.fechaReserva === fFecha || r.fechaEntrega === fFecha;
      return okEst && okCli && okMat && okFec;
    });

    this.admReservasCount.textContent = `${filtradas.length} registro(s)`;
    this.tbodyGestionReservas.innerHTML = "";

    if (filtradas.length === 0) {
      this.tbodyGestionReservas.innerHTML = `<tr><td colspan="9" style="text-align:center;">No se encontraron reservas con los filtros aplicados.</td></tr>`;
      return;
    }

    filtradas.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${r.idReserva}</strong></td>
        <td>
          <strong>${r.cliente.nombre}</strong><br>
          <small class="text-muted">C.C. ${r.cliente.documento}</small>
        </td>
        <td>
          <code>${r.material.codigo}</code><br>
          <span>${r.material.titulo}</span>
        </td>
        <td><code>${r.ejemplar ? r.ejemplar.codigoBarras : "N/A"}</code></td>
        <td>${r.fechaSolicitud}</td>
        <td>${r.fechaReserva}</td>
        <td>${r.fechaEntrega}</td>
        <td><span class="badge-estado ${r.getCssClassEstado()}">${r.getNombreEstado()}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs btn-row-inspect" title="Inspeccionar Trazabilidad">🔍 Inspeccionar</button>
            <button class="btn btn-success btn-xs btn-row-approve" title="Aprobar Reserva (Patrón State)">✅ Aprobar</button>
            <button class="btn btn-primary btn-xs btn-row-edit" title="Editar Fecha / Renovar">📅 Editar Fecha</button>
            <button class="btn btn-dark btn-xs btn-row-finish" title="Finalizar / Devolución">📦 Devolución</button>
            <button class="btn btn-danger btn-xs btn-row-cancel" title="Cancelar Reserva">❌ Cancelar</button>
          </div>
        </td>
      `;

      tr.querySelector(".btn-row-inspect").addEventListener("click", () => {
        this.reservaSeleccionadaId = r.idReserva;
        this.actualizarDetalleVistaInspector();
        this.renderSelectorReservas();
        this.mostrarComprobanteReservaModal(r, `🔍 Inspección de Trazabilidad - Reserva #${r.idReserva}`);
      });

      tr.querySelector(".btn-row-approve").addEventListener("click", () => this.accionAprobarReserva(r.idReserva));
      tr.querySelector(".btn-row-edit").addEventListener("click", () => this.abrirModalEditarFecha(r.idReserva));
      tr.querySelector(".btn-row-finish").addEventListener("click", () => this.abrirModalFinalizarDevolucion(r.idReserva));
      tr.querySelector(".btn-row-cancel").addEventListener("click", () => this.abrirModalConfirmarCancelacion(r.idReserva));

      this.tbodyGestionReservas.appendChild(tr);
    });
  }

  accionAprobarReserva(idReserva) {
    const r = this.reservas.find(res => res.idReserva === idReserva);
    if (!r) return;

    this.reservaSeleccionadaId = idReserva;
    const res = r.aprobar();
    this.guardarEnLocalStorage();
    this.refrescarTodasLasVistas();

    if (res.exito) {
      this.log(res.mensaje, "success");
      this.enviarNotificacionAutomatica(r.cliente, `Reserva #${r.idReserva} APROBADA (${r.material.titulo})`);
      this.mostrarToast(res.mensaje, "success");
    } else {
      this.log(res.mensaje, "rejected");
      this.mostrarToast(res.mensaje, "error");
    }
  }

  // Modal Editar Fecha / Renovar Préstamo o Reserva
  abrirModalEditarFecha(idReserva) {
    const r = this.reservas.find(res => res.idReserva === idReserva);
    if (!r) return;

    this.reservaSeleccionadaId = idReserva;
    document.getElementById("edit-reserva-id").value = r.idReserva;
    document.getElementById("edit-fecha-inicio").value = r.fechaReserva;
    document.getElementById("edit-fecha-entrega").value = r.fechaEntrega;
    document.getElementById("modal-editar-alert").className = "alert hidden";

    document.getElementById("modal-editar-detalle").innerHTML = `
      <p><strong>Reserva:</strong> #${r.idReserva} [${r.getNombreEstado()}]</p>
      <p><strong>Cliente:</strong> ${r.cliente.nombre} (${r.cliente.documento})</p>
      <p><strong>Material / Ejemplar:</strong> [${r.material.codigo}] ${r.material.titulo} (${r.ejemplar ? r.ejemplar.codigoBarras : "N/A"})</p>
    `;

    document.getElementById("modal-editar-fecha").classList.remove("hidden");
  }

  guardarEdicionFechaReserva() {
    const idReserva = parseInt(document.getElementById("edit-reserva-id").value, 10);
    const fInicio = document.getElementById("edit-fecha-inicio").value;
    const fEntrega = document.getElementById("edit-fecha-entrega").value;
    const alertBox = document.getElementById("modal-editar-alert");

    const r = this.reservas.find(res => res.idReserva === idReserva);
    if (!r) return;

    if (fEntrega < fInicio) {
      alertBox.textContent = "La fecha de entrega no puede ser anterior a la fecha de inicio.";
      alertBox.className = "alert alert-danger";
      return;
    }

    const hayConflicto = r.ejemplar
      ? this.verificarConflictoFechasEjemplar(r.ejemplar.idEjemplar, fInicio, fEntrega, r.idReserva)
      : false;

    const resultado = r.editarReserva(fInicio, fEntrega, hayConflicto);

    if (!resultado.exito) {
      alertBox.textContent = resultado.mensaje;
      alertBox.className = "alert alert-danger";
      this.log(resultado.mensaje, "rejected");
      this.mostrarToast(resultado.mensaje, "error");
      return;
    }

    this.guardarEnLocalStorage();
    document.getElementById("modal-editar-fecha").classList.add("hidden");
    this.log(resultado.mensaje, "success");
    this.mostrarToast(resultado.mensaje, "success");
    this.refrescarTodasLasVistas();
  }

  // Modal Finalizar Reserva / Registrar Devolución (con estado físico del ejemplar y simulación de fallo de red)
  abrirModalFinalizarDevolucion(idReserva) {
    const r = this.reservas.find(res => res.idReserva === idReserva);
    if (!r) return;

    this.reservaSeleccionadaId = idReserva;
    // Si no está en estado Confirmada, dejar que el Patrón State lo rechace inmediatamente para evidenciar el bloqueo
    if (r.getNombreEstado() !== "CONFIRMADA") {
      const res = r.finalizar();
      this.log(res.mensaje, "rejected");
      this.mostrarToast(res.mensaje, "error");
      this.refrescarTodasLasVistas();
      return;
    }

    this.reservaIdPendienteDevolucion = idReserva;
    document.getElementById("devolucion-condicion").value = "BUEN_ESTADO";
    document.getElementById("devolucion-simular-fallo-red").checked = false;

    document.getElementById("modal-devolucion-detalle").innerHTML = `
      <p><strong>Reserva a Finalizar:</strong> #${r.idReserva} (${r.getNombreEstado()})</p>
      <p><strong>Cliente:</strong> ${r.cliente.nombre} (${r.cliente.documento})</p>
      <p><strong>Material:</strong> [${r.material.codigo}] ${r.material.titulo}</p>
      <p><strong>Ejemplar Físico:</strong> ${r.ejemplar ? r.ejemplar.codigoBarras : "N/A"}</p>
      <p><strong>Fecha Pactada de Entrega:</strong> ${r.fechaEntrega}</p>
    `;

    document.getElementById("modal-finalizar-devolucion").classList.remove("hidden");
  }

  ejecutarDevolucionConfirmada() {
    const r = this.reservas.find(res => res.idReserva === this.reservaIdPendienteDevolucion);
    if (!r) return;

    const condicion = document.getElementById("devolucion-condicion").value;
    const simularFallo = document.getElementById("devolucion-simular-fallo-red").checked;
    const fechaRealEntrega = new Date().toISOString().split("T")[0];

    document.getElementById("modal-finalizar-devolucion").classList.add("hidden");

    if (simularFallo) {
      this.log(`Error de Sincronización al registrar devolución de Reserva #${r.idReserva}. Conservando fecha real de entrega (${fechaRealEntrega}) y reintentando automáticamente...`, "warning");
      this.mostrarToast(`Error de Sincronización: Reintentando automáticamente sin perder la fecha real de entrega (${fechaRealEntrega})...`, "warning");

      setTimeout(() => {
        const res = r.finalizar(condicion);
        this.guardarEnLocalStorage();
        this.log(`[REINTENTO EXITOSO] ${res.mensaje} (Fecha real preservada: ${fechaRealEntrega}).`, "success");
        this.mostrarToast(`Sincronización recuperada: ${res.mensaje}`, "success");
        this.refrescarTodasLasVistas();
      }, 1200);
      return;
    }

    const res = r.finalizar(condicion);
    this.guardarEnLocalStorage();
    this.refrescarTodasLasVistas();

    if (res.exito) {
      this.log(res.mensaje, "success");
      this.mostrarToast(res.mensaje, "success");
    } else {
      this.log(res.mensaje, "rejected");
      this.mostrarToast(res.mensaje, "error");
    }
  }

  // Modal Reserva Presencial por el Bibliotecario (HU-001)
  abrirModalReservaPresencial() {
    const selectCli = document.getElementById("pres-cliente-doc");
    const selectMat = document.getElementById("pres-material-cod");
    const alertBox = document.getElementById("modal-presencial-alert");
    alertBox.className = "alert hidden";

    selectCli.innerHTML = "";
    this.clientes.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.documento;
      opt.textContent = `${c.documento} - ${c.nombre} [${c.getNombreEstadoCliente()}]`;
      selectCli.appendChild(opt);
    });

    selectMat.innerHTML = "";
    this.materiales.forEach(m => {
      m.sincronizarEstadoGeneral();
      const opt = document.createElement("option");
      opt.value = m.codigo;
      opt.textContent = `[${m.codigo}] ${m.titulo} (${m.estado})`;
      selectMat.appendChild(opt);
    });

    document.getElementById("pres-fecha-inicio").value = "2026-11-26";
    document.getElementById("pres-fecha-entrega").value = "2026-11-29";

    document.getElementById("modal-reserva-presencial").classList.remove("hidden");
  }

  confirmarReservaPresencial() {
    const docCli = document.getElementById("pres-cliente-doc").value;
    const codMat = document.getElementById("pres-material-cod").value;
    const fInicio = document.getElementById("pres-fecha-inicio").value;
    const fEntrega = document.getElementById("pres-fecha-entrega").value;
    const alertBox = document.getElementById("modal-presencial-alert");

    const cliente = this.clientes.find(c => c.documento === docCli);
    const material = this.materiales.find(m => m.codigo === codMat);

    // HU-001 CA-02: Validar que el cliente esté activo y sin estado moroso
    const validacionCli = cliente.validarPermisoReserva();
    if (!validacionCli.permitido) {
      alertBox.textContent = validacionCli.mensaje;
      alertBox.className = "alert alert-danger";
      this.log(`HU-001 CA-02 Bloqueo: ${validacionCli.mensaje}`, "rejected");
      this.mostrarToast(validacionCli.mensaje, "error");
      return;
    }

    if (fEntrega < fInicio) {
      alertBox.textContent = "La fecha de entrega debe ser igual o posterior a la fecha de reserva.";
      alertBox.className = "alert alert-warning";
      return;
    }

    // HU-001 CA-03: Verificar ejemplar disponible sin conflicto para esa fecha
    const ejemplarLibre = material.ejemplares.find(ej =>
      ej.getNombreEstado() !== "En Reparación" &&
      ej.getNombreEstado() !== "Prestado" &&
      !this.verificarConflictoFechasEjemplar(ej.idEjemplar, fInicio, fEntrega)
    );

    if (!ejemplarLibre) {
      const msgConflicto = "Fecha No Disponible: El ejemplar ya se encuentra reservado para este periodo";
      alertBox.textContent = msgConflicto;
      alertBox.className = "alert alert-danger";
      this.log(`HU-001 CA-03 Bloqueo: ${msgConflicto} (${material.codigo}).`, "rejected");
      this.mostrarToast(msgConflicto, "error");
      return;
    }

    // Registrar Reserva Presencial y actualizar ejemplar a Reservado
    ejemplarLibre.reservar();
    material.sincronizarEstadoGeneral();

    const nuevoId = this.reservas.length > 0 ? Math.max(...this.reservas.map(r => r.idReserva)) + 1 : 101;
    const hoyISO = new Date().toISOString().split("T")[0];
    const nueva = new Reserva(nuevoId, cliente, material, ejemplarLibre, fInicio, fEntrega, new EstadoPendiente(), hoyISO);

    this.reservas.push(nueva);
    this.reservaSeleccionadaId = nuevoId;
    this.guardarEnLocalStorage();

    document.getElementById("modal-reserva-presencial").classList.add("hidden");
    this.log(`HU-001 CA-04: Reserva Presencial #${nuevoId} registrada para ${cliente.nombre} (${cliente.documento}). Ejemplar [${ejemplarLibre.codigoBarras}] ➔ 'Reservado'.`, "success");
    this.enviarNotificacionAutomatica(cliente, `Comprobante de Reserva Presencial #${nuevoId} (${material.titulo})`);
    this.refrescarTodasLasVistas();

    // HU-001 CA-04: Mostrar resumen en pantalla
    this.mostrarComprobanteReservaModal(nueva, "✅ Resumen de Reserva Presencial Exitosa (HU-001 CA-04)");
  }

  mostrarComprobanteReservaModal(reserva, titulo = "🔍 Comprobante y Resumen de Reserva") {
    document.getElementById("modal-inspect-title").textContent = titulo;
    document.getElementById("modal-inspect-content").innerHTML = `
      <div class="summary-card">
        <p><strong>ID de Reserva:</strong> #${reserva.idReserva}</p>
        <p><strong>Estado Actual (Patrón State):</strong> <span class="badge-estado ${reserva.getCssClassEstado()}">${reserva.getNombreEstado()}</span></p>
        <hr style="margin: 10px 0; border: none; border-top: 1px solid #cbd5e1;">
        <p><strong>Código del Cliente (Cédula):</strong> ${reserva.cliente.documento}</p>
        <p><strong>Nombre del Cliente:</strong> ${reserva.cliente.nombre}</p>
        <p><strong>Correo Institucional:</strong> ${reserva.cliente.email}</p>
        <hr style="margin: 10px 0; border: none; border-top: 1px solid #cbd5e1;">
        <p><strong>Material Reservado:</strong> [${reserva.material.codigo}] ${reserva.material.titulo}</p>
        <p><strong>Autor / Categoría:</strong> ${reserva.material.autor} (${reserva.material.categoria})</p>
        <p><strong>Ejemplar Físico Asignado:</strong> ${reserva.ejemplar ? `${reserva.ejemplar.codigoBarras} - ${reserva.ejemplar.estanteUbicacion} [${reserva.ejemplar.getNombreEstado()}]` : "N/A"}</p>
        <hr style="margin: 10px 0; border: none; border-top: 1px solid #cbd5e1;">
        <p><strong>Fecha de Solicitud:</strong> ${reserva.fechaSolicitud}</p>
        <p><strong>Fecha de Reserva:</strong> ${reserva.fechaReserva}</p>
        <p><strong>Fecha Estimada de Entrega:</strong> ${reserva.fechaEntrega}</p>
      </div>
    `;
    document.getElementById("modal-inspeccionar-reserva").classList.remove("hidden");
  }

  // --------------------------------------------------------------------------
  // MÓDULO B3: GESTIÓN DE EJEMPLARES (VALIDACIÓN OBLIGATORIA DE CÓDIGO)
  // --------------------------------------------------------------------------
  renderGestionEjemplares() {
    const query = (this.ejSearchQuery.value || "").trim().toLowerCase();
    const fEstado = this.ejFilterEstado.value;

    const filtrados = this.ejemplares.filter(ej => {
      const mat = this.materiales.find(m => m.codigo === ej.codigoMaterial);
      const titulo = mat ? mat.titulo.toLowerCase() : "";
      const okQuery = !query ||
        ej.codigoBarras.toLowerCase().includes(query) ||
        ej.codigoMaterial.toLowerCase().includes(query) ||
        ej.estanteUbicacion.toLowerCase().includes(query) ||
        titulo.includes(query);
      const okEst = fEstado === "TODOS" || ej.getNombreEstado() === fEstado;
      return okQuery && okEst;
    });

    this.tbodyGestionEjemplares.innerHTML = "";
    filtrados.forEach(ej => {
      const mat = this.materiales.find(m => m.codigo === ej.codigoMaterial);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${ej.idEjemplar}</td>
        <td><code>${ej.codigoBarras}</code></td>
        <td><strong><code>${ej.codigoMaterial}</code></strong></td>
        <td>${mat ? mat.titulo : "N/A"}</td>
        <td>${ej.estanteUbicacion}</td>
        <td>${ej.condicionFisica}</td>
        <td><span class="tag-status ${ej.getCssClassEstado()}">${ej.getNombreEstado()}</span></td>
        <td>
          <button class="btn btn-primary btn-xs btn-cambiar-est-ej" data-id="${ej.idEjemplar}">
            🔄 Actualizar Estado Físico
          </button>
        </td>
      `;

      tr.querySelector(".btn-cambiar-est-ej").addEventListener("click", () => {
        this.abrirModalCambiarEstadoEjemplar(ej.idEjemplar);
      });

      this.tbodyGestionEjemplares.appendChild(tr);
    });
  }

  abrirModalCambiarEstadoEjemplar(idEjemplar) {
    const ej = this.ejemplares.find(e => e.idEjemplar === idEjemplar);
    if (!ej) return;
    const mat = this.materiales.find(m => m.codigo === ej.codigoMaterial);

    document.getElementById("ej-modal-id").value = ej.idEjemplar;
    document.getElementById("ej-modal-expected-code").textContent = ej.codigoMaterial;
    document.getElementById("ej-modal-confirm-codigo").value = "";
    document.getElementById("ej-modal-nuevo-estado").value = ej.getNombreEstado();
    document.getElementById("modal-ejemplar-alert").className = "alert hidden";

    document.getElementById("modal-ejemplar-info").innerHTML = `
      <p><strong>Ejemplar:</strong> <code>${ej.codigoBarras}</code> (${ej.estanteUbicacion})</p>
      <p><strong>Libro Asociado:</strong> [${ej.codigoMaterial}] ${mat ? mat.titulo : ""}</p>
      <p><strong>Estado Actual (Patrón State):</strong> <span class="tag-status ${ej.getCssClassEstado()}">${ej.getNombreEstado()}</span></p>
    `;

    document.getElementById("modal-cambiar-estado-ejemplar").classList.remove("hidden");
  }

  confirmarCambioEstadoEjemplar() {
    const idEj = parseInt(document.getElementById("ej-modal-id").value, 10);
    const codigoIngresado = document.getElementById("ej-modal-confirm-codigo").value.trim().toUpperCase();
    const nuevoEstado = document.getElementById("ej-modal-nuevo-estado").value;
    const alertBox = document.getElementById("modal-ejemplar-alert");

    const ej = this.ejemplares.find(e => e.idEjemplar === idEj);
    if (!ej) return;

    // RNF Fiabilidad: Validación obligatoria del código del libro antes de permitir el cambio de estado
    if (codigoIngresado !== ej.codigoMaterial.toUpperCase()) {
      const msgError = `Error de Fiabilidad: El código ingresado (${codigoIngresado || "vacío"}) no coincide con el código del libro [${ej.codigoMaterial}]. Cambio de estado denegado.`;
      alertBox.textContent = msgError;
      alertBox.className = "alert alert-danger";
      this.log(msgError, "rejected");
      this.mostrarToast(msgError, "error");
      return;
    }

    const resultado = ej.cambiarCondicionPorNombre(nuevoEstado);
    if (!resultado.exito) {
      alertBox.textContent = resultado.mensaje;
      alertBox.className = "alert alert-danger";
      this.log(resultado.mensaje, "rejected");
      this.mostrarToast(resultado.mensaje, "error");
      return;
    }

    const mat = this.materiales.find(m => m.codigo === ej.codigoMaterial);
    if (mat) mat.sincronizarEstadoGeneral();

    this.guardarEnLocalStorage();
    document.getElementById("modal-cambiar-estado-ejemplar").classList.add("hidden");
    this.log(`Patrón State Ejemplar: ${resultado.mensaje}`, "success");
    this.mostrarToast(resultado.mensaje, "success");
    this.refrescarTodasLasVistas();
  }

  // --------------------------------------------------------------------------
  // MÓDULO B4: GESTIÓN DE CLIENTES (PATRÓN STATE CLIENTE)
  // --------------------------------------------------------------------------
  renderGestionClientes() {
    const query = (this.cliSearchQuery.value || "").trim().toLowerCase();
    const fEstado = this.cliFilterEstado.value;

    const filtrados = this.clientes.filter(c => {
      const okQuery = !query ||
        c.nombre.toLowerCase().includes(query) ||
        c.documento.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query);
      const okEst = fEstado === "TODOS" || c.getNombreEstadoCliente() === fEstado;
      return okQuery && okEst;
    });

    this.tbodyGestionClientes.innerHTML = "";
    filtrados.forEach(c => {
      const est = c.getNombreEstadoCliente();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.documento}</strong></td>
        <td>${c.nombre}</td>
        <td>${c.email}</td>
        <td><span class="tag-status ${c.getCssClassEstadoCliente()}">${est}</span></td>
        <td>${c.estadoSancion ? "🔴 Sí (Bloqueado)" : "🟢 No"}</td>
        <td><strong>$${c.morosidad.toLocaleString("es-CO")}</strong></td>
        <td>${c.fechaFinSancion || "-"}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-warning btn-xs btn-cli-sancionar" title="Aplicar Sanción / Morosidad">⚖️ Aplicar Sanción</button>
            <button class="btn btn-success btn-xs btn-cli-regularizar" title="Retirar Sanción / Regularizar Mora">✔️ Regularizar Mora</button>
            ${est !== "Inactivo"
              ? `<button class="btn btn-dark btn-xs btn-cli-desactivar">🚫 Desactivar</button>`
              : `<button class="btn btn-primary btn-xs btn-cli-activar">🔓 Reactivar Cuenta</button>`}
          </div>
        </td>
      `;

      tr.querySelector(".btn-cli-sancionar").addEventListener("click", () => {
        const res = c.aplicarSancion(20000, "2026-12-20");
        this.procesarResultadoTransicionCliente(res);
      });

      tr.querySelector(".btn-cli-regularizar").addEventListener("click", () => {
        const res = c.regularizarMora();
        this.procesarResultadoTransicionCliente(res);
      });

      const btnDesact = tr.querySelector(".btn-cli-desactivar");
      if (btnDesact) {
        btnDesact.addEventListener("click", () => {
          const res = c.desactivarCuenta();
          this.procesarResultadoTransicionCliente(res);
        });
      }

      const btnAct = tr.querySelector(".btn-cli-activar");
      if (btnAct) {
        btnAct.addEventListener("click", () => {
          const res = c.activarCuenta();
          this.procesarResultadoTransicionCliente(res);
        });
      }

      this.tbodyGestionClientes.appendChild(tr);
    });
  }

  procesarResultadoTransicionCliente(res) {
    this.guardarEnLocalStorage();
    this.refrescarTodasLasVistas();
    if (res.exito) {
      this.log(`Patrón State Cliente: ${res.mensaje}`, "success");
      this.mostrarToast(res.mensaje, "success");
    } else {
      this.log(res.mensaje, "rejected");
      this.mostrarToast(res.mensaje, "error");
    }
  }

  // --------------------------------------------------------------------------
  // MÓDULO B5: GESTIÓN DEL CATÁLOGO E IMPORTACIÓN CSV / XLSX CON LOG POR FILA
  // --------------------------------------------------------------------------
  registrarNuevoMaterialCatalogo() {
    const codigo = document.getElementById("new-lib-codigo").value.trim().toUpperCase();
    const categoria = document.getElementById("new-lib-categoria").value;
    const titulo = document.getElementById("new-lib-titulo").value.trim();
    const autor = document.getElementById("new-lib-autor").value.trim();
    const desc = document.getElementById("new-lib-desc").value.trim();
    const numCopias = parseInt(document.getElementById("new-lib-copias").value, 10) || 1;
    const estante = document.getElementById("new-lib-estante").value.trim();

    if (this.materiales.some(m => m.codigo.toUpperCase() === codigo)) {
      this.mostrarToast(`El código de material ${codigo} ya existe en el catálogo.`, "error");
      this.log(`Catálogo: Intento de duplicar código de material [${codigo}].`, "rejected");
      return;
    }

    const nuevosEjemplares = [];
    for (let i = 0; i < numCopias; i++) {
      const nextId = this.ejemplares.length > 0 ? Math.max(...this.ejemplares.map(e => e.idEjemplar)) + 1 : 1001;
      const ej = new Ejemplar(nextId, `EJ-${nextId}`, codigo, estante, "Nuevo", "Disponible");
      this.ejemplares.push(ej);
      nuevosEjemplares.push(ej);
    }

    const nuevoMat = new MaterialBibliografico(codigo, titulo, autor, categoria, desc, nuevosEjemplares);
    this.materiales.push(nuevoMat);
    this.guardarEnLocalStorage();

    this.formNuevoLibro.reset();
    this.log(`Catálogo: Registrado nuevo material [${codigo}] '${titulo}' con ${numCopias} ejemplar(es) en ${estante}.`, "success");
    this.mostrarToast(`Material [${codigo}] registrado con ${numCopias} ejemplar(es).`, "success");
    this.refrescarTodasLasVistas();
  }

  leerArchivoCsvSubido(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.csvRawTextarea.value = e.target.result;
      this.mostrarToast(`Archivo '${file.name}' cargado en el editor de lote. Haz clic en Procesar e Importar.`, "info");
    };
    reader.readAsText(file);
  }

  procesarImportacionCSV() {
    const rawText = (this.csvRawTextarea.value || "").trim();
    if (!rawText) {
      this.mostrarToast("El contenido del lote CSV/XLSX está vacío.", "warning");
      return;
    }

    const lineas = rawText.split(/\r?\n/);
    let importados = 0;
    let rechazados = 0;
    const detalleResultados = [];

    lineas.forEach((linea, index) => {
      const numFila = index + 1;
      const textoFila = linea.trim();
      if (!textoFila) return;

      // Soportar separador ';' o ','
      const sep = textoFila.includes(";") ? ";" : ",";
      const cols = textoFila.split(sep).map(c => c.trim());

      // Validar que tenga al menos 5 columnas obligatorias no vacías y código con formato válido
      const codigoValido = cols.length >= 5 &&
        /^LIB-\d{3,}$/i.test(cols[0]) &&
        cols[1].length > 0 &&
        cols[2].length > 0 &&
        cols[3].length > 0 &&
        cols[4].length > 0;

      if (!codigoValido) {
        rechazados++;
        // RNF Mantenibilidad - Logs: Mensaje exacto requerido
        const msgErrorFila = `Fila [${numFila}]: Formato no reconocido. Registro no importado`;
        detalleResultados.push(`<div class="text-danger">❌ ${msgErrorFila} (<code>${textoFila}</code>)</div>`);
        this.log(msgErrorFila, "rejected");
        return;
      }

      const [codRaw, titulo, autor, categoria, estante, descripcion = "Material importado vía lote CSV/XLSX"] = cols;
      const codigo = codRaw.toUpperCase();

      // Si el libro ya existe, agregar un nuevo ejemplar; si no, crear el material y su ejemplar
      const nextId = this.ejemplares.length > 0 ? Math.max(...this.ejemplares.map(e => e.idEjemplar)) + 1 : 1001;
      const nuevoEj = new Ejemplar(nextId, `EJ-${nextId}`, codigo, estante, "Importado CSV", "Disponible");
      this.ejemplares.push(nuevoEj);

      let matExistente = this.materiales.find(m => m.codigo === codigo);
      if (matExistente) {
        matExistente.ejemplares.push(nuevoEj);
        matExistente.sincronizarEstadoGeneral();
      } else {
        const nuevoMat = new MaterialBibliografico(codigo, titulo, autor, categoria, descripcion, [nuevoEj]);
        this.materiales.push(nuevoMat);
      }

      importados++;
      detalleResultados.push(`<div class="text-success">✔️ Fila [${numFila}]: Importado [${codigo}] ${titulo} (Ejemplar ${nuevoEj.codigoBarras})</div>`);
      this.log(`Sincronización CSV Fila [${numFila}]: Material [${codigo}] '${titulo}' importado con éxito.`, "success");
    });

    this.guardarEnLocalStorage();
    this.refrescarTodasLasVistas();

    this.csvImportResults.classList.remove("hidden");
    this.csvImportResults.innerHTML = `
      <h4>Resultado de Sincronización CSV/XLSX: ${importados} importado(s) · ${rechazados} rechazado(s)</h4>
      <div style="margin-top:8px; font-size:0.83rem;">${detalleResultados.join("")}</div>
    `;

    this.mostrarToast(`Sincronización finalizada: ${importados} importados, ${rechazados} con error de formato.`, rechazados > 0 ? "warning" : "success");
  }

  // --------------------------------------------------------------------------
  // MÓDULO B6: GENERACIÓN DE REPORTES (PDF / EXCEL CSV) Y NOTIFICACIONES
  // --------------------------------------------------------------------------
  generarReporteActual() {
    const tipo = this.repTipo.value;
    const estadoFiltro = this.repFiltroEstado.value;
    const query = (this.repFiltroQuery.value || "").trim().toLowerCase();

    let titulo = "";
    let columnas = [];
    let filas = [];

    if (tipo === "DIARIO") {
      titulo = "Reporte Diario de Turno (Reservas Activas y Clientes en Mora)";
      columnas = ["ID Reserva", "Cédula Cliente", "Nombre Cliente", "Código Material", "Título", "Ejemplar", "F. Reserva", "F. Entrega", "Estado", "Alerta Mora"];
      const resFiltradas = this.reservas.filter(r => {
        const okEst = estadoFiltro === "TODOS" || r.getNombreEstado() === estadoFiltro;
        const okQ = !query ||
          r.material.codigo.toLowerCase().includes(query) ||
          r.cliente.documento.toLowerCase().includes(query) ||
          r.cliente.nombre.toLowerCase().includes(query);
        return okEst && okQ;
      });

      filas = resFiltradas.map(r => [
        `#${r.idReserva}`,
        r.cliente.documento,
        r.cliente.nombre,
        r.material.codigo,
        r.material.titulo,
        r.ejemplar ? r.ejemplar.codigoBarras : "N/A",
        r.fechaReserva,
        r.fechaEntrega,
        r.getNombreEstado(),
        r.cliente.estadoSancion ? `EN MORA ($${r.cliente.morosidad})` : "Al día"
      ]);
    } else if (tipo === "RESERVAS") {
      titulo = "Reporte General de Reservas por Criterio (HU-005)";
      columnas = ["ID Reserva", "Documento", "Cliente", "Código Libro", "Descripción / Título", "F. Solicitud", "F. Reserva", "F. Entrega", "Estado"];
      const resFiltradas = this.reservas.filter(r => {
        const okEst = estadoFiltro === "TODOS" || r.getNombreEstado() === estadoFiltro;
        const okQ = !query ||
          r.material.codigo.toLowerCase().includes(query) ||
          r.material.titulo.toLowerCase().includes(query) ||
          r.cliente.documento.toLowerCase().includes(query) ||
          r.cliente.nombre.toLowerCase().includes(query);
        return okEst && okQ;
      });

      filas = resFiltradas.map(r => [
        `#${r.idReserva}`,
        r.cliente.documento,
        r.cliente.nombre,
        r.material.codigo,
        r.material.titulo,
        r.fechaSolicitud,
        r.fechaReserva,
        r.fechaEntrega,
        r.getNombreEstado()
      ]);
    } else if (tipo === "MOROSIDAD") {
      titulo = "Reporte Administrativo de Clientes en Morosidad y Sanciones";
      columnas = ["Documento", "Nombre Cliente", "Correo", "Estado Cliente", "Sanción Activa", "Valor Morosidad ($)", "Sancionado Hasta"];
      const cliFiltrados = this.clientes.filter(c => {
        const esMoroso = c.getNombreEstadoCliente() === "En Morosidad" || c.estadoSancion;
        const okQ = !query ||
          c.documento.toLowerCase().includes(query) ||
          c.nombre.toLowerCase().includes(query);
        return esMoroso && okQ;
      });

      filas = cliFiltrados.map(c => [
        c.documento,
        c.nombre,
        c.email,
        c.getNombreEstadoCliente(),
        c.estadoSancion ? "SÍ" : "NO",
        `$${c.morosidad.toLocaleString("es-CO")} COP`,
        c.fechaFinSancion || "2026-12-15"
      ]);
    }

    this.reporteActual = new Reporte(Date.now(), tipo, titulo, filas, columnas);

    // RNF Interoperabilidad: Si no hay datos, mostrar mensaje exacto
    if (filas.length === 0) {
      this.reporteEmptyMsg.classList.remove("hidden");
      this.reportePreviewContainer.classList.add("hidden");
      return;
    }

    this.reporteEmptyMsg.classList.add("hidden");
    this.reportePreviewContainer.classList.remove("hidden");

    const thHtml = columnas.map(c => `<th>${c}</th>`).join("");
    const trHtml = filas.map(fila => `<tr>${fila.map(val => `<td>${val}</td>`).join("")}</tr>`).join("");

    this.reportePreviewContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
        <div>
          <strong>${this.reporteActual.titulo}</strong>
          <div class="text-muted">Generado el: ${this.reporteActual.fechaGeneracion} · Total filas: ${filas.length}</div>
        </div>
        <span class="tag-status status-disponible">Procesado en &lt; 1s</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </div>
    `;
  }

  descargarReporteCSV() {
    if (!this.reporteActual || this.reporteActual.filasDatos.length === 0) {
      this.mostrarToast("Sin Registros: No se encontraron datos para los filtros seleccionados", "error");
      this.log("Exportación CSV bloqueada: Sin Registros para los filtros seleccionados.", "rejected");
      return;
    }

    const csvContent = this.reporteActual.exportarCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SIGREB_Reporte_${this.reporteActual.tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.log(`Reporte [${this.reporteActual.titulo}] exportado a Excel/CSV (${this.reporteActual.filasDatos.length} registros).`, "success");
    this.mostrarToast("Archivo Excel/CSV descargado exitosamente.", "success");
  }

  imprimirReportePDF() {
    if (!this.reporteActual || this.reporteActual.filasDatos.length === 0) {
      this.mostrarToast("Sin Registros: No se encontraron datos para los filtros seleccionados", "error");
      this.log("Exportación PDF bloqueada: Sin Registros para los filtros seleccionados.", "rejected");
      return;
    }

    this.log(`Reporte [${this.reporteActual.titulo}] enviado a vista de exportación/impresión PDF.`, "info");
    window.print();
  }

  // Tolerancia a fallos en notificaciones automáticas (RNF Notificaciones automáticas)
  enviarNotificacionAutomatica(cliente, asunto) {
    if (this.simularFalloRedNotificacion) {
      const msgFallo = `Notificación a [${cliente.email}] ('${asunto}') falló en el envío ➔ Marcada como "Pendiente de reintento" y alerta enviada al bibliotecario.`;
      this.log(msgFallo, "warning");
      this.mostrarToast(`Alerta al Bibliotecario: Envío de correo fallido. Marcado como "Pendiente de reintento".`, "warning");
      return;
    }
    this.log(`Notificación automática enviada a [${cliente.email}]: ${asunto} (< 2 min).`, "info");
  }

  // --------------------------------------------------------------------------
  // TERMINAL DE LOGS Y NOTIFICACIONES TOAST (POP-UPS)
  // --------------------------------------------------------------------------
  log(mensaje, tipo = "info") {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    this.logs.push({ time: timeStr, tipo, msg: mensaje });
    this.guardarEnLocalStorage();
    this.renderTerminalLogs();
  }

  renderTerminalLogs() {
    if (!this.logTerminal) return;
    this.logTerminal.innerHTML = "";

    this.logs.forEach(item => {
      const entry = document.createElement("div");
      entry.className = "log-entry";

      let tagHtml = `<span class="log-tag info">[INFO]</span>`;
      if (item.tipo === "success") tagHtml = `<span class="log-tag success">[TRANSICIÓN OK]</span>`;
      if (item.tipo === "rejected") tagHtml = `<span class="log-tag rejected">[BLOQUEO STATE / ERROR]</span>`;
      if (item.tipo === "warning") tagHtml = `<span class="log-tag warning">[ALERTA / REINTENTO]</span>`;

      entry.innerHTML = `<span class="log-time">${item.time}</span> ${tagHtml} ${item.msg}`;
      this.logTerminal.appendChild(entry);
    });

    this.logTerminal.scrollTop = this.logTerminal.scrollHeight;
  }

  mostrarToast(mensaje, tipo = "info") {
    if (!this.toastContainer) return;
    const toast = document.createElement("div");
    let cssTipo = "toast-info";
    let icono = "ℹ️";
    if (tipo === "success") { cssTipo = "toast-success"; icono = "✅"; }
    if (tipo === "error") { cssTipo = "toast-error"; icono = "⛔"; }
    if (tipo === "warning") { cssTipo = "toast-warning"; icono = "⚠️"; }

    toast.className = `toast-item ${cssTipo}`;
    toast.innerHTML = `
      <div><strong>${icono}</strong> ${mensaje}</div>
      <button style="background:none;border:none;cursor:pointer;font-weight:bold;color:#64748b;">&times;</button>
    `;

    toast.querySelector("button").addEventListener("click", () => toast.remove());
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.sigrebApp = new BibliotecaApp();
});