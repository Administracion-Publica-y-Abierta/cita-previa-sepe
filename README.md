# Cita previa SEPE

Una forma decente de enterarse de que hay cita en el SEPE, y de pedirla sin
sufrir.

Proyecto independiente, sin relación con el Servicio Público de Empleo
Estatal.

## El problema

La agenda del SEPE se libera a ratos y sin avisar. Quien necesita una cita
entra en la web cada pocas horas a ver si hay suerte, con una interfaz de
1,3 MB de JavaScript que no está pensada para eso. Se pierden huecos por no
estar mirando en el minuto exacto.

## La idea

Una aplicación web que se añade a la pantalla de inicio del móvil y **avisa
por notificación cuando aparece un hueco** del trámite y la zona que te
interesen. Si quieres, te acompaña también en la reserva: te enseña el
captcha para que lo resuelvas tú y espera el SMS.

**Avisar es lo principal; reservar es secundario y siempre contigo delante.**
Hay pocas citas, y una herramienta que las acaparase sola se las quitaría a
quien no la usa.

## Estado

En construcción. El andamiaje ya está: la aplicación arranca, la batería de
tests corre y hay fixtures de tráfico real del SEPE con los que probar. El
buscador todavía no.

- [ ] Comprobar si el SEPE ata la sesión a la IP (bloquea todo lo demás)
- [ ] Fase 1 — buscador de huecos, solo lectura
- [ ] Fase 2 — avisos con Web Push
- [ ] Fase 3 — reserva asistida

## Ponerlo en marcha

```sh
npm install
npm run dev     # la aplicación, en http://localhost:3000
npm test        # la batería de tests
```

No hace falta configurar nada: los tests no salen a la red, contestan con
tráfico real del SEPE ya grabado y anonimizado. Cómo se escribe un test aquí
—y cómo se rehacen esas grabaciones— está en [AGENTS.md](AGENTS.md).

La especificación completa está en **[ESPECIFICACION.md](ESPECIFICACION.md)**:
arquitectura, flujos, modelo de datos, límites medidos y lo que hay que
despejar antes de escribir código.

Existe ya un **prototipo funcional en Python** que hace todo esto por
Telegram y que se usa a diario. No está publicado aquí todavía; vive en
local mientras se decide cómo encaja. De él salen los datos medidos que
aparecen en la especificación.

## Pila prevista

Next.js en Vercel para la interfaz y el proxy hacia el SEPE (sus respuestas
no traen cabeceras CORS, así que las peticiones van desde el servidor).
Supabase para las suscripciones y el vigilante programado. Web Push para los
avisos. Todo en planes gratuitos.

## Cómo ayudar

Mira [CONTRIBUTING.md](CONTRIBUTING.md). Ahora mismo lo más útil es opinar
sobre la especificación antes de que nadie escriba código.

## Licencia

Pendiente de añadir.
