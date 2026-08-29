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
- [ ] Fase 2 — avisos con Web Push (**hoy no existen**: la web lo dice)
- [ ] Fase 3 — reserva asistida

## Ponerlo en marcha

```sh
npm install
npm run dev     # la aplicación, en http://localhost:3000
npm test        # la batería de tests
```

En local no hace falta configurar nada: los tests no salen a la red, contestan
con tráfico real del SEPE ya grabado y anonimizado, y el estado compartido cae
a la memoria del proceso.

**Para probarla como aplicación del móvil** —añadida a la pantalla de inicio, y
abriendo sin cobertura— hace falta la versión de producción: el service worker
no se registra en `npm run dev`, porque servir de la caché unos ficheros que
cambian a cada guardado es depurar contra código de hace dos cambios.

```sh
npm run build && npm start   # y ahí sí: instalar, apagar la red y recargar
npm run iconos               # rehace los iconos si cambia el dibujo
```

**Desplegado sí hace falta.** El ritmo de peticiones al SEPE y la caché viven
en un Redis compartido, porque en serverless la memoria del proceso no
sobrevive entre invocaciones y sin estado compartido no hay freno que valga.
Dos variables de entorno, las que pone la integración de Vercel (o sus
equivalentes `UPSTASH_REDIS_REST_*`):

```sh
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Opcionales, con sus valores de fábrica: `CACHE_TTL_MS` (90000) y
`CACHE_ANCHO_DE_CLAVE` (`codigo-postal`, o `provincia` el día que alguien mida
que se puede).

En local, sin esas variables, la aplicación arranca con el almacén en memoria y
lo avisa por el registro. **Desplegada no arranca**: sin estado compartido el
freno solo vale dentro de cada invocación, que es como no tenerlo, y eso es una
avería y no un detalle de configuración. Cómo se escribe un test aquí
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
no traen cabeceras CORS, así que las peticiones van desde el servidor). Redis
gestionado para el freno compartido y la caché. MapLibre GL JS para el mapa,
con las teselas de OpenFreeMap: **sin clave de API**, que en una web de
servicio público no es un detalle. Supabase para las suscripciones y el
vigilante programado. Web Push para los avisos. Todo en planes gratuitos.

## Cómo ayudar

Mira [CONTRIBUTING.md](CONTRIBUTING.md). Ahora mismo lo más útil es opinar
sobre la especificación antes de que nadie escriba código.

## Licencia

Pendiente de añadir.
