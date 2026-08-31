# ¿El SEPE ata la sesión a la IP de origen?

Código de usar y tirar. **No entra en `src/`, no tiene tests y se borra cuando
la pregunta esté contestada** — lo que queda entonces es la respuesta, escrita
en `ESPECIFICACION.md` §6.

Es la fase 0 de `ESPECIFICACION.md` §9 y el issue #24. Bloquea la agenda de una
oficina y la reserva, que son los dos flujos que tienen que caminar una sesión
por varias pantallas y varias invocaciones.

## Las dos mitades

La pregunta parece una sola y son dos, y hacerlas en este orden no es
comodidad: **la segunda no se puede leer sin la primera**.

### 1. ¿Mira el endpoint la sesión siquiera?

```sh
node experimentos/ip-y-sesion/desde-aqui.mjs
```

Cabe en una máquina. Compara cuatro casos contra `cargaTiposAtencionMapa`:
cookie recién repartida, sin cookie, cookie inventada, y —para que el control
no tenga trampa— portada visitada pero cookie tirada.

Si contestara igual en los cuatro, el endpoint no miraría la sesión, y
entonces mandarle una cookie desde otra IP daría «no está atada» siendo cierto
por el motivo equivocado. **Ya está medido y sí la mira**: ver más abajo.

### 2. ¿Le importa que la sesión llegue desde otra IP?

Esta no cabe en una máquina: hacen falta dos IPs de salida. Se despliega la
carpeta suelta —lleva su `package.json` y `api/sonda.js`, sin configuración— y
se la conduce desde aquí:

```sh
cd experimentos/ip-y-sesion && vercel deploy     # o el alojamiento que sea
node experimentos/ip-y-sesion/dos-invocaciones.mjs https://…/api/sonda
```

La sonda tiene tres pasos, y el tercero es el que hace legible el
experimento:

| paso | qué hace |
|---|---|
| `abrir` | pide la portada y devuelve el `JSESSIONID` y la IP por la que salió |
| `usar` | usa esa cookie contra el mapa y devuelve qué contestó y la IP |
| `ambos` | las dos cosas en **la misma** invocación: el control |

## Lo que ya está medido (31-08-2026, 21:20–21:35 CEST, 08401)

- **`cargaTiposAtencionMapa` sí mira la sesión.** Con la cookie recién
  repartida contestó **5 de 13** veces; sin cookie, con una cookie inventada y
  con la portada visitada pero la cookie tirada, **0 de 34**. La diferencia no
  es casualidad (Fisher, p ≈ 0,0008), y el cuarto caso deja claro que lo que
  vale es **la cookie** y no haber pasado por la portada.

- **`cargaComboNivelesTramitesCPEntidad` NO mira la sesión.** Contestó lo mismo
  —8 trámites— con la cookie buena, sin ninguna cookie y con una inventada. El
  catálogo es apátrida, así que **la fase 1 no está expuesta a esta pregunta**:
  aunque la sesión estuviera atada a la IP, el buscador seguiría funcionando.

- **El SEPE solo contesta ~3 de cada 8 veces** aun con todo correcto, y eso es
  lo que obliga a comparar tasas y no respuestas sueltas. Es la misma
  intermitencia que `AGENTS.md` ya recoge —vacío y 46 oficinas con treinta
  segundos de diferencia—, medida otra vez aquí sin querer.

- **La portada reparte un `JSESSIONID` nuevo en cada visita**, reconozca o no
  la cookie que se le manda. Por eso no sirve como detector de «¿reconoces
  esta sesión?», que era el atajo evidente y no lo es.

- **Las pantallas del recorrido de la agenda contestan con el cuerpo vacío.**
  `showPantallaCalendario` devuelve 0 bytes con la sesión caminada, con la
  sesión pelada y sin cookie: son llamadas que dejan estado en el servidor y
  no lo cuentan. Lo único que lee ese estado es `calendarioServicio`, y **pide
  `documento`**, o sea un DNI, que es justo lo que esta fase no maneja.

## Lo que falta, y por qué no está hecho

La mitad de las dos IPs no se ha ejecutado: hace falta desplegar, y eso es una
cuenta de alguien. El código está listo y calibrado — que es lo que hacía falta
para que, cuando se ejecute, lo que salga se pueda creer.

Y hay un límite que conviene no perder: aun con dos IPs, esto mide la sesión
**del mapa**. El recorrido entero de la agenda solo se puede comprobar con un
DNI delante, así que si el mapa saliera «no atada», eso es una señal muy buena
pero no la prueba completa del flujo de reserva.
