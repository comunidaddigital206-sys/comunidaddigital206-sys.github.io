/* Lógica de turnos compartida.
   IMPORTANTE: este mismo bloque está copiado en backend/Code.gs para que el
   servidor valide igual que la página. Si cambiás algo acá, copialo allá. */

function aMin(h) { var p = String(h).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function aHora(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function fechaDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dateDe(f) { var p = f.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function sumarDias(f, n) { var d = dateDe(f); d.setDate(d.getDate() + n); return fechaDe(d); }

/* Franjas abiertas de un día: primero mira si hay una excepción para esa fecha
   (cerrado o horario especial); si no, usa la semana tipo. */
function franjasDelDia(cfg, fecha) {
  if (cfg.excepciones && Object.prototype.hasOwnProperty.call(cfg.excepciones, fecha)) return cfg.excepciones[fecha] || [];
  return (cfg.semana && cfg.semana[String(dateDe(fecha).getDay())]) || [];
}

function turnosActivos(turnos) { return turnos.filter(function (t) { return t.estado !== 'cancelado'; }); }

/* ahora = { fecha: 'YYYY-MM-DD', min: minutos desde las 00:00 } */
function horariosLibres(cfg, turnos, fecha, duracion, ahora) {
  if (fecha < ahora.fecha || fecha > sumarDias(ahora.fecha, Number(cfg.diasVista) || 30)) return [];
  var paso = Number(cfg.paso) || 30;
  var desde = fecha === ahora.fecha ? ahora.min + (Number(cfg.anticipacionMin) || 0) : -1;
  var ocupado = turnosActivos(turnos).filter(function (t) { return t.fecha === fecha; })
    .map(function (t) { var a = aMin(t.hora); return [a, a + Number(t.duracion)]; });
  var libres = [];
  franjasDelDia(cfg, fecha).forEach(function (f) {
    var fin = aMin(f[1]);
    for (var t = aMin(f[0]); t + duracion <= fin; t += paso) {
      if (t < desde) continue;
      var choca = ocupado.some(function (o) { return t < o[1] && t + duracion > o[0]; });
      if (!choca) libres.push(aHora(t));
    }
  });
  return libres;
}

function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }

/* Devuelve un texto de error o null si la reserva es válida. */
function validarReserva(cfg, turnos, d, ahora) {
  var serv = (cfg.servicios || []).filter(function (s) { return s.id === d.servicio; })[0];
  if (!serv) return 'Elegí un servicio.';
  if (!d.nombre || String(d.nombre).trim().length < 2) return 'Escribí tu nombre.';
  if (soloDigitos(d.telefono).length < 8) return 'Revisá el número de WhatsApp.';
  if (horariosLibres(cfg, turnos, d.fecha, Number(serv.duracion), ahora).indexOf(d.hora) === -1)
    return 'Ese horario se acaba de ocupar. Elegí otro.';
  var tel = soloDigitos(d.telefono).slice(-8);
  var futuros = turnosActivos(turnos).filter(function (t) {
    return t.fecha >= ahora.fecha && soloDigitos(t.telefono).slice(-8) === tel;
  });
  if (futuros.length >= 2) return 'Ya tenés 2 turnos reservados. Para otro, escribinos por WhatsApp.';
  return null;
}

function haySuperposicion(turnos, fecha, hora, duracion) {
  var a = aMin(hora), b = a + Number(duracion);
  return turnosActivos(turnos).some(function (t) {
    if (t.fecha !== fecha) return false;
    var x = aMin(t.hora); return a < x + Number(t.duracion) && b > x;
  });
}
/* fin del bloque compartido */

var CONFIG_INICIAL = {
  nombre: 'Tu Peluquería', direccion: 'Olavarría', whatsapp: '', emailAviso: '',
  paso: 30, diasVista: 30, anticipacionMin: 120,
  servicios: [
    { id: 'corte', nombre: 'Corte', duracion: 30, precio: '' },
    { id: 'corte-brushing', nombre: 'Corte y brushing', duracion: 60, precio: '' },
    { id: 'color', nombre: 'Color', duracion: 120, precio: '' },
    { id: 'mechas', nombre: 'Mechas / balayage', duracion: 180, precio: '' },
    { id: 'peinado', nombre: 'Peinado para evento', duracion: 60, precio: '' }
  ],
  semana: {
    '0': [], '1': [],
    '2': [['09:00', '13:00'], ['16:00', '20:00']], '3': [['09:00', '13:00'], ['16:00', '20:00']],
    '4': [['09:00', '13:00'], ['16:00', '20:00']], '5': [['09:00', '13:00'], ['16:00', '20:00']],
    '6': [['09:00', '14:00']]
  },
  excepciones: {}
};

/* ---------- Conexión con el servidor ----------
   Pegá acá la URL de la implementación de Apps Script (termina en /exec).
   Vacía = modo demostración: todo se guarda solo en este navegador. */
var API_URL = '';

function ahoraLocal() { var d = new Date(); return { fecha: fechaDe(d), min: d.getHours() * 60 + d.getMinutes() }; }
function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

var Demo = (function () {
  var KEY = 'turnos-peluqueria-demo-v1', memoria = null;
  function semilla() {
    var cfg = JSON.parse(JSON.stringify(CONFIG_INICIAL)); cfg.nombre = 'Peluquería Demo';
    var ahora = ahoraLocal(), turnos = [], nombres = ['Carla M.', 'Sofía R.', 'Mariela G.', 'Lucía P.', 'Anabel T.'];
    for (var i = 1, k = 0; i <= 8 && k < 5; i++) {
      var f = sumarDias(ahora.fecha, i), libres = horariosLibres(cfg, turnos, f, 60, ahora);
      if (libres.length) {
        turnos.push({ id: nuevoId(), fecha: f, hora: libres[k % libres.length], duracion: 60, servicio: 'Corte y brushing',
          nombre: nombres[k], telefono: '22845' + (10000 + k * 1111), nota: '', estado: 'confirmado', creado: new Date().toISOString() });
        k++;
      }
    }
    return { cfg: cfg, turnos: turnos, pin: '1234' };
  }
  function leer() {
    if (memoria) return memoria;
    try { var s = localStorage.getItem(KEY); if (s) memoria = JSON.parse(s); } catch (e) {}
    if (!memoria) { memoria = semilla(); guardar(); }
    return memoria;
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(memoria)); } catch (e) {} }
  function chequearPin(pin) { if (String(pin) !== String(leer().pin)) throw new Error('PIN incorrecto.'); }
  return {
    publico: function () { var db = leer(); return { cfg: db.cfg, ocupados: turnosActivos(db.turnos).map(function (t) { return { fecha: t.fecha, hora: t.hora, duracion: t.duracion }; }) }; },
    reservar: function (d) {
      var db = leer(), err = validarReserva(db.cfg, db.turnos, d, ahoraLocal());
      if (err) throw new Error(err);
      var serv = db.cfg.servicios.filter(function (s) { return s.id === d.servicio; })[0];
      var t = { id: nuevoId(), fecha: d.fecha, hora: d.hora, duracion: Number(serv.duracion), servicio: serv.nombre,
        nombre: String(d.nombre).trim(), telefono: String(d.telefono).trim(), nota: String(d.nota || '').trim(), estado: 'confirmado', creado: new Date().toISOString() };
      db.turnos.push(t); guardar(); return { id: t.id };
    },
    admin: function (pin) { chequearPin(pin); var db = leer(); return { cfg: db.cfg, turnos: db.turnos }; },
    guardarConfig: function (pin, cfg) { chequearPin(pin); leer().cfg = cfg; guardar(); return { ok: true }; },
    cancelar: function (pin, id) { chequearPin(pin); leer().turnos.forEach(function (t) { if (t.id === id) t.estado = 'cancelado'; }); guardar(); return { ok: true }; },
    agregar: function (pin, d) {
      chequearPin(pin); var db = leer();
      if (haySuperposicion(db.turnos, d.fecha, d.hora, d.duracion)) throw new Error('Se superpone con otro turno de ese día.');
      var t = { id: nuevoId(), fecha: d.fecha, hora: d.hora, duracion: Number(d.duracion), servicio: d.servicio || '',
        nombre: d.nombre || '', telefono: d.telefono || '', nota: d.nota || '', estado: d.nombre ? 'confirmado' : 'bloqueo', creado: new Date().toISOString() };
      db.turnos.push(t); guardar(); return { id: t.id };
    },
    cambiarPin: function (pin, nuevo) { chequearPin(pin); leer().pin = String(nuevo); guardar(); return { ok: true }; },
    reiniciar: function () { memoria = semilla(); guardar(); }
  };
})();

var Remoto = {
  _get: function (accion) {
    return fetch(API_URL + '?accion=' + accion).then(function (r) { return r.json(); }).then(Remoto._ok);
  },
  _post: function (datos) {
    // text/plain evita el "preflight" CORS que Apps Script no soporta
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json(); }).then(Remoto._ok);
  },
  _ok: function (r) { if (r && r.error) throw new Error(r.error); return r; },
  publico: function () { return Remoto._get('publico'); },
  reservar: function (d) { return Remoto._post({ accion: 'reservar', datos: d }); },
  admin: function (pin) { return Remoto._post({ accion: 'admin', pin: pin }); },
  guardarConfig: function (pin, cfg) { return Remoto._post({ accion: 'guardarConfig', pin: pin, cfg: cfg }); },
  cancelar: function (pin, id) { return Remoto._post({ accion: 'cancelar', pin: pin, id: id }); },
  agregar: function (pin, d) { return Remoto._post({ accion: 'agregar', pin: pin, datos: d }); },
  cambiarPin: function (pin, nuevo) { return Remoto._post({ accion: 'cambiarPin', pin: pin, nuevo: nuevo }); }
};

var MODO_DEMO = !API_URL;
var API = {};
['publico', 'reservar', 'admin', 'guardarConfig', 'cancelar', 'agregar', 'cambiarPin'].forEach(function (k) {
  API[k] = function () {
    var args = arguments;
    if (!MODO_DEMO) return Remoto[k].apply(null, args);
    return new Promise(function (ok, mal) { setTimeout(function () { try { ok(Demo[k].apply(null, args)); } catch (e) { mal(e); } }, 250); });
  };
});

/* utilidades de presentación */
var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(f) { var d = dateDe(f); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
function duracionTxt(m) { m = Number(m); var h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function waNumero(n) { n = soloDigitos(n).replace(/^0+/, ''); if (n.length === 10) n = '549' + n; return n; }
function linkWA(numero, texto) { return 'https://wa.me/' + waNumero(numero) + '?text=' + encodeURIComponent(texto); }
