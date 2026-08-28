import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import Portada from '@/app/page'

/**
 * Montar la portada y usarla como la usa quien llega.
 *
 * Está aquí y no repetido en cada fichero de test porque escribir un código
 * postal y pulsar el botón es el principio de casi todos: el día que el campo
 * cambie de nombre o el botón de texto, se arregla una vez.
 *
 * Se monta la portada entera y no un componente suelto a propósito. La mitad
 * de lo que esta web promete —que se entienda que esto no es el SEPE, que la
 * lista se recorra con teclado— vive en lo que rodea al formulario.
 */

export const CODIGO_POSTAL = 'Código postal'
export const BOTON = /comprobar horas/i

export function montarPortada(): UserEvent {
  const persona = userEvent.setup()
  render(<Portada />)
  return persona
}

export async function buscar(persona: UserEvent, codigoPostal: string): Promise<void> {
  await persona.type(screen.getByLabelText(CODIGO_POSTAL), codigoPostal)
  await persona.click(screen.getByRole('button', { name: BOTON }))
}

/** La lista de oficinas, una vez ha llegado. */
export function listaDeOficinas(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('list', { name: /oficinas/i }))
}

/**
 * El encabezado de los resultados, que ya no es el único de la pantalla: el
 * filtro de trámites tiene el suyo.
 */
export function tituloDeLosResultados(): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: /^Resultados/i })
}

/** El campo del código postal, para mirar lo que tiene escrito. */
export function campoDelCodigoPostal(): HTMLInputElement {
  return screen.getByLabelText(CODIGO_POSTAL) as HTMLInputElement
}
