# Especificación — Cita previa SEPE (webapp)

Estado: borrador de diseño. Nada de esto está construido todavía.
El prototipo que funciona hoy es el de `old/` (Python + Telegram), que sirve
como referencia del flujo real del SEPE.

---

## 1. Qué queremos

Que alguien que necesita una cita del SEPE se entere de que hay hueco sin
tener que estar mirando, y que reservarla no sea un suplicio.

### Principio de diseño

**Avisar es lo principal. Reservar es secundario y siempre con la persona
delante.**

No es escrúpulo decorativo: hay pocas citas, y una herramienta que las
acaparase automáticamente se las quitaría a quien no la usa. El captcha y
el SMS los resuelve la persona; la app le ahorra la espera y los clics, no
le adelanta el turno a nadie.

---

## 2. Arquitectura

Tres piezas, todas en plan gratuito.

```
   Navegador (PWA)
        |
        v
   Next.js en Vercel  ──────────────>  citaprevia-sede.sepe.gob.es
   · interfaz                             (siempre desde el servidor:
   · flujo de reserva a demanda            el SEPE no manda cabeceras
   · proxy hacia el SEPE                   CORS, un navegador no puede
   · estado en cookie cifrada              leer sus respuestas)
        ^
        |  Web Push
        |
   Supabase (gratis)
   · Postgres: preferencias y suscripciones
   · pg_cron: dispara el vigilante cada N minutos
   · Edge Function: hace la pasada y notifica
```

### Por qué Next.js no puede hacerlo todo

Serverless es un timbre, no un portero: el código solo vive mientras
contesta una petición. El flujo de reserva encaja de fábrica porque siempre
hay un humano esperando. El vigilante no, porque tiene que mirar a las 7:45
aunque no haya nadie. En el plan gratuito de Vercel, cron corre **una vez al
día**, así que el vigilante vive en Supabase.

---

## 3. Flujo A — Reserva a demanda (Next.js)

Cada paso es una petición corta. Sin base de datos.

| Paso | Ruta | Qué hace |
|---|---|---|
| 1 | `POST /api/sesion` | Abre sesión en el SEPE, guarda `JSESSIONID` |
| 2 | `GET /api/tramites` | Catálogo de trámites para un CP |
| 3 | `GET /api/oficinas` | Oficinas con hueco, ordenadas por distancia |
| 4 | `GET /api/calendario` | Días y horas libres de una oficina |
| 5 | `POST /api/retener` | `reservaCita` — aparta el hueco ~10 min |
| 6 | `GET /api/captcha` | Proxy de la imagen, atada a la sesión |
| 7 | `POST /api/validar` | Formulario + captcha |
| 8 | `POST /api/sms` | Dispara el SMS |
| 9 | `POST /api/confirmar` | `crearCita` |

### Estado: una cookie, cero base de datos

Todo lo que hay que recordar entre pasos son unos cientos de bytes:

```
JSESSIONID, idOficina, idServicio, fechaHora,
idCitaReserva, idVerificacion, datos del solicitante
```

Va en una **cookie cifrada `httpOnly`** del propio dominio. El Route Handler
la descifra y coloca el `JSESSIONID` a mano en la cabecera `Cookie` de su
`fetch` al SEPE.

Dos ventajas: no hace falta Redis ni Postgres para reservar, y el DNI nunca
toca un disco nuestro.

### Corrección: la Fase 1 sí necesita un almacén compartido

Lo de arriba sigue valiendo **para el estado de la reserva**: eso va en la
cookie y no toca disco. Lo que no se sostiene es el "sin base de datos" a
secas, y el motivo no es la caché sino **el freno**.

En serverless no hay memoria compartida entre invocaciones: un limitador que
vive en variables del proceso deja sencillamente de existir, y dos visitantes
simultáneos llaman al SEPE en el mismo instante, sin los 2,5 segundos de
separación. "Sin base de datos" acaba significando "sin freno", y eso
`CONTRIBUTING.md` no lo admite.

Así que la Fase 1 lleva un punto de coordinación compartido —Redis gestionado
en plan gratuito— que sostiene tres cosas: el cubo de fichas del ritmo global,
el contador de vacíos consecutivos que lo endurece y, ya que está, la caché de
consultas. Se prefiere a Postgres por una razón operativa que esta misma
especificación ya recoge en §7: el proyecto gratuito de Supabase se pausa a los
siete días sin actividad, y esta fase puede pasar semanas sin una visita.

Sin configurar, la aplicación cae a un almacén en memoria y lo avisa por el
registro: vale en local, no vale desplegado.

**Aviso operativo**: desde el paso 5 hay un reloj de diez minutos. La
interfaz debe enseñarlo.

---

## 4. Flujo B — Vigilante compartido (Supabase)

`pg_cron` despierta cada N minutos a una Edge Function que:

1. Lee la **unión de combinaciones distintas** de (trámite, CP, radio) de
   todos los usuarios suscritos.
2. Hace una pasada por cada combinación, respetando el ritmo.
3. Compara con lo visto en la pasada anterior.
4. Manda Web Push a quien encaje.

Barrer la unión y no una vez por usuario es lo que hace que esto escale al
revés de lo habitual: **cien personas interesadas en el mismo trámite son
una consulta, no cien**. Menos carga para el SEPE que si cada uno vigilase
por su cuenta.

### Modelo de datos

```sql
create table suscripciones (
  id            uuid primary key default gen_random_uuid(),
  push_endpoint text not null,          -- suscripción Web Push
  push_p256dh   text not null,
  push_auth     text not null,
  codigo_postal text not null,
  id_tramite    int  not null,
  radio_km      int  not null default 50,
  canal         text not null default 'presencial',
  creada        timestamptz default now(),
  ultimo_aviso  timestamptz
);

create table huecos_vistos (
  clave      text primary key,          -- tramite|oficina|canal|fechaHora
  visto_en   timestamptz default now()
);
```

No hay tabla de usuarios, ni cuentas, ni contraseñas. La suscripción push
**es** la identidad. Quien quiera irse, borra la suscripción desde el
navegador y la fila se limpia sola cuando el push falla con 410.

---

## 5. Multiplataforma: PWA

Objetivo: que se pueda añadir a la pantalla de inicio en iOS y Android,
reciba avisos, y quede preparada para empaquetarla en las tiendas si algún
día interesa.

### Lo que hay que construir

- `manifest.json` — nombre, iconos (192 y 512 px), `display: standalone`,
  color de tema.
- **Service worker** — recibe el push y muestra la notificación.
- **VAPID** — par de claves para firmar los envíos. La privada, en Supabase.

### iOS: la restricción que manda sobre el diseño

En iPhone, **la Push API solo existe si la web está añadida a la pantalla de
inicio**. Una pestaña de Safari abierta no vale: no tiene acceso a
`PushManager`. Disponible desde iOS 16.4, y a principios de 2026 más del 95%
de los iPhone van con iOS 16 o superior.

Consecuencia directa para la interfaz: **en iOS hay que guiar a añadir a la
pantalla de inicio ANTES de pedir permiso de notificaciones**, porque si se
pide antes, no hay nada que pedir. Detectar iOS y enseñar las instrucciones
(Compartir → Añadir a pantalla de inicio) es trabajo obligatorio, no un
adorno.

En Android el push funciona también en pestaña, así que ahí el flujo es el
normal.

Dos novedades recientes que conviene tener en el radar: Safari 18.4 introdujo
*Declarative Web Push*, que no necesita service worker; y en iOS 26 todo
sitio añadido a la pantalla de inicio se abre como web app por defecto.

### Camino a las tiendas, si algún día

- **Google Play**: una PWA se publica con Trusted Web Activity casi tal cual.
- **App Store**: se envuelve con Capacitor, pero Apple rechaza envoltorios
  finos de una web por la directriz 4.2 (funcionalidad mínima). Habría que
  añadir algo nativo de verdad. No lo demos por hecho.

Construir bien la PWA no compromete nada: es el punto de partida de las dos
rutas.

---

## 6. La incógnita que hay que despejar ANTES de construir

**¿El SEPE ata la sesión a la IP de origen?**

Si la ata, el flujo de reserva se rompe en Vercel, porque cada paso sale de
una invocación distinta con IP distinta. Y se rompería en el peor momento:
con el hueco retenido y el reloj corriendo.

El experimento está escrito y calibrado en `experimentos/ip-y-sesion/` —código
de usar y tirar, fuera de `src/` y sin tests, que se borra cuando la pregunta
esté cerrada—. Lo medido hasta ahora está abajo; lo que falta, al final.

### Lo medido (31-08-2026, 08401)

**La fase 1 no está expuesta a esta pregunta, y eso ya se puede dar por bueno.**
`cargaComboNivelesTramitesCPEntidad` —el catálogo de trámites— contesta
exactamente lo mismo con la cookie buena, sin ninguna cookie y con una
inventada. Es apátrida: no hay ahí sesión que atar a ninguna IP. El buscador
seguiría funcionando aunque la respuesta a la pregunta grande fuera la mala.

**`cargaTiposAtencionMapa` sí mira la sesión**, y por eso es el sitio correcto
donde preguntar. Con la cookie recién repartida contestó 5 de 13 veces; sin
cookie, con una inventada, y con la portada visitada pero la cookie tirada, 0
de 34 (Fisher, p ≈ 0,0008). Ese cuarto caso está para separar «vale la cookie»
de «vale haber pasado por la portada»: es la cookie. Los totales salen de dos
pasadas, una de 5 intentos por caso y otra de 8; están desglosadas en el
`README.md` del experimento para que se puedan repetir.

Tres cosas medidas de paso que cambian cómo hay que leer cualquier medición
futura contra el SEPE:

- **El SEPE solo contesta ~3 de cada 8 veces aun con todo correcto.** Es la
  intermitencia que ya está en la tabla de §7, y obliga a comparar **tasas**
  y no respuestas sueltas: un cero suelto no distingue «está atada» de «hoy no
  contesta». Por eso la sonda desplegable lleva un paso de control que hace
  las dos mitades en la misma invocación.
- **La primera llamada del mapa trae `listaOficina` vacía** y solo los canales;
  las oficinas salen por `cargaOficinasMapa`. El listón de «ha contestado» son
  los canales, no las oficinas — pedir oficinas aquí haría fallar el control
  por un motivo que no tiene que ver con la sesión.
- **La portada reparte un `JSESSIONID` nuevo en cada visita**, reconozca o no
  la que se le mande. No sirve como detector de «¿reconoces esta sesión?», que
  era el atajo evidente.

### Lo que falta

**La mitad de las dos IPs.** Hace falta desplegar la sonda y conducirla desde
fuera (`dos-invocaciones.mjs`), y eso es una cuenta de alguien. La lectura no
cambia respecto a lo que ya decía esta sección: si las cruzadas contestan al
mismo ritmo que el control, la sesión no está atada y la agenda y la reserva se
despliegan tal cual; si el control contesta y las cruzadas no, hace falta
salida con IP fija —un proxy en una máquina propia (treinta líneas) o IP de
egreso dedicada, de pago—, y eso cambia arquitectura y coste.

**Y un límite que no se quita desplegando.** Esto mide la sesión *del mapa*. Las
pantallas del recorrido de la agenda (`showPantalla*`) contestan con el cuerpo
vacío tanto con la sesión caminada como sin ella: dejan estado en el servidor y
no lo cuentan. Lo único que lee ese estado es `calendarioServicio`, y pide
`documento` —un DNI—, que es justo lo que esta fase no maneja. Así que un «no
está atada» del mapa es una señal muy buena para la fase 3, pero no la prueba
completa de su flujo.

Nótese la asimetría: **el vigilante casi no sufre este problema**, porque
cada pasada es una sesión nueva y corta que no arrastra nada. Aunque el test
salga mal, el flujo B sigue siendo viable.

---

## 7. Límites conocidos

| Límite | Valor | De dónde sale |
|---|---|---|
| Ritmo mínimo al SEPE | 2,5 s + jitter | medido: por debajo deja de contestar |
| Respuestas vacías | no significan "sin agenda" | medido: vacío y 46 oficinas en 30 s |
| Pasada de 9 trámites | ~44 s | medido |
| Edge Function (Supabase free) | 150 s | documentación |
| Cron en Vercel Hobby | 1 vez al día | documentación |
| Proyecto Supabase free | se pausa a los 7 días sin actividad | documentación |
| Retención del hueco | ~10 min | `fechaMaxReserva` del SEPE |

El freno adaptativo del prototipo vive en memoria del proceso. En serverless
esa memoria no existe: hay que sacar el limitador a Postgres o a Redis, o
cada invocación empezará atropellando al SEPE.

---

## 8. Protección de datos

El argumento de "solo somos un proxy" vale **para el flujo A**: si el DNI y
el teléfono viajan en la cookie del usuario y no tocan disco, la exposición
es mínima.

**Deja de valer con el flujo B.** Una tabla que dice "este endpoint quiere
cita para prestaciones por desempleo" son datos personales, y esa
combinación revela que alguien está en paro. Mínimos: aviso de privacidad,
borrado a petición, retención corta.

Trampa que se cuela sola: **los logs**. Vercel y Supabase registran
peticiones; un DNI en una query string o en un mensaje de error queda
guardado sin haberlo decidido. El DNI siempre en el cuerpo de un POST,
nunca en la URL, y limpiar lo que se escribe en los errores.

---

## 9. Fases

**0. Despejar la incógnita.** El experimento de la IP. Sin esto, todo lo
demás es especulación.

**1. Solo lectura.** Next.js + PWA + buscador de huecos. Sin reserva, sin
cuentas, sin base de datos. Ya mejora lo que hay.

**2. Avisos.** Supabase, suscripciones push, `pg_cron`, el vigilante
compartido. Es la parte que de verdad resuelve el problema.

**3. Reserva asistida.** El flujo completo con captcha y SMS. Lo último,
porque es lo más frágil y lo que más cuidado exige.

---

## 10. Referencias

El flujo real del SEPE (endpoints, parámetros, respuestas) está
documentado de hecho en el código de `old/`, verificado contra una captura
de red real. Puntos de entrada:

- `old/webapp_cita_sepe.py` — cliente, throttling, geocodificación
- `old/vigila_sepe_telegram.py` — clase `Reserva`: el flujo completo de
  reserva, paso a paso, con los parámetros exactos de cada llamada
