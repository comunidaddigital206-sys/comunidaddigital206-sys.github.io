# Turnos para peluquería

- `index.html` es la página donde reservan las clientas (este link se comparte por WhatsApp o Instagram).
- `admin.html` es el panel de la dueña: agenda, horarios, servicios y ajustes.
- `backend/Code.gs` es el servidor gratis en Google Sheets.

Mientras `API_URL` (en `logica.js`) esté vacío, la app funciona en **modo demo**: los datos se guardan solo en ese navegador y el PIN es `1234`. Sirve para mostrarla, pero no para usarla de verdad.

## Pasarla a modo real (10 minutos, con la cuenta de Google de la dueña)

1. Entrar a sheets.google.com y crear una planilla en blanco llamada "Turnos peluquería".
2. Ir a **Extensiones → Apps Script**. Borrar lo que haya y pegar todo `backend/Code.gs`. Guardar.
3. Arriba, en el selector de funciones, elegir **instalar** y tocar **Ejecutar**. Aceptar los permisos (Google avisa que la app "no está verificada": ir a *Configuración avanzada → Ir a…*). Eso crea las hojas *Turnos* y *Config* y pone el PIN `1234`.
4. Ir a **Implementar → Nueva implementación → tipo Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Copiar la URL que termina en `/exec` y pegarla en `logica.js`, en `var API_URL = '...'`.
6. Subir los cambios, entrar al panel, **cambiar el PIN** y cargar en Ajustes el nombre, la dirección y el WhatsApp del local.

Si después se modifica `Code.gs`, hay que ir a **Implementar → Administrar implementaciones → editar → Nueva versión**. Si no, sigue funcionando la versión vieja.

## Cómo funciona

- **Semana tipo**: la dueña carga una sola vez qué días y en qué horarios atiende, y eso se repite todas las semanas. **Días especiales** sirve para feriados, vacaciones u horarios distintos.
- Cada servicio tiene su duración. Un color de 2 h ocupa 2 h de agenda, así no se superponen.
- El servidor vuelve a revisar cada reserva con un candado, así dos clientas no pueden tomar el mismo horario.
- Cada número de teléfono puede tener como máximo 2 turnos futuros (para frenar reservas falsas).
- La página pública solo muestra qué horarios están ocupados, nunca los nombres ni los teléfonos.
- Con cada turno nuevo llega un mail a la dueña con un link para escribirle a la clienta por WhatsApp.
- Desde la agenda puede **Recordar** (abre WhatsApp con el mensaje ya escrito), **Cancelar**, o **agregar turnos que le pidieron por teléfono y bloquear horarios**.
- La dueña también puede ver todos los turnos en la planilla de Google.

## Qué NO hace todavía

- No cobra seña. Si las clientas faltan mucho, este es el próximo paso (Mercado Pago).
- No manda recordatorios automáticos: los manda la dueña con un toque desde el panel.
- Está pensada para **una sola profesional**. Si trabajan varias peluqueras a la vez, hay que agregar la opción de elegir peluquera.
- `logica.js` y `Code.gs` repiten el mismo bloque de cálculo de horarios. Si se cambia uno, hay que copiar el cambio en el otro.
