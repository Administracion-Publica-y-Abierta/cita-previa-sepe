# Cómo colaborar

Gracias por pasarte. Este proyecto es pequeño y las cosas útiles que puedes
hacer también lo son.

## Lo que más falta

**Probarlo fuera de Barcelona.** Está desarrollado con el código postal
08401 y los trámites de prestaciones. No sabemos qué se rompe en otras
provincias ni con otros trámites. Si lo pruebas y falla, abre un issue con
el código postal, el identificador del trámite y lo que dice el log.

**Identificadores de trámite que cambian.** El SEPE los cambia sin avisar.
`python3 webapp_cita_sepe.py --catalogo TU_CP` lista los que existen hoy.

## Ahora mismo

El repositorio está en fase de diseño: lo más útil que puedes hacer es leer
[ESPECIFICACION.md](ESPECIFICACION.md) y discutir lo que no encaje. Es mucho
más barato cambiar una decisión ahí que dentro de tres semanas de código.

## Estilo

El código y los comentarios están en castellano. Los comentarios explican
**por qué**, no qué: si una pausa dura 2,5 segundos, el comentario dice por
qué no puede ser menos, no que es una pausa.

## Dos reglas que no son de estilo

**No subas nunca `vigila_sepe.env`.** Lleva DNI, teléfono y el token del
bot. Está en `.gitignore`; que siga.

**No aceleres el ritmo de peticiones.** La pausa entre llamadas al SEPE no
es prudencia excesiva: sin ella deja de responder, y además machacar la
infraestructura de un servicio público con dinero de todos está feo. Los
pull requests que quiten el freno no se van a aceptar.
