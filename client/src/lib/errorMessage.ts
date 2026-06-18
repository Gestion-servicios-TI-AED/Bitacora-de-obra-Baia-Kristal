// Traduce cualquier error (de axios o genérico) a un mensaje CLARO en español para el
// usuario final. La idea es que quien está en obra entienda qué pasó y qué hacer, en vez de
// ver mensajes técnicos o un genérico "Error".
//
// Prioridad:
//   1. El mensaje que envía el servidor (ya es específico, p. ej. "Esta torre ya tiene
//      registro para hoy" o "La foto supera el tamaño máximo permitido").
//   2. Si la petición salió pero no hubo respuesta → problema de señal/conexión.
//   3. Según el código de estado HTTP, un mensaje entendible.
//   4. Mensaje del propio error JS, o un texto de respaldo.

export function getFriendlyError(
    err: any,
    fallback = 'Ocurrió un error inesperado. Por favor intente de nuevo.'
): string {
    // 1. Mensaje explícito del servidor.
    const serverMsg = err?.response?.data?.error;
    if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;

    // 2. Salió la petición pero no llegó respuesta: típico corte de señal en obra.
    if (err?.request && !err?.response) {
        return 'No hay conexión con el servidor. Revise su señal a internet e intente de nuevo. No se guardó nada.';
    }

    // 3. Según el código de estado, cuando el servidor no devolvió un mensaje legible.
    const status = err?.response?.status;
    switch (status) {
        case 413:
            return 'La imagen es demasiado pesada. Use una foto más liviana e intente de nuevo.';
        case 400:
            return 'Hay datos incompletos o no válidos en el formulario. Revíselos e intente de nuevo.';
        case 401:
        case 403:
            return 'Su sesión expiró o no tiene permisos para esta acción. Vuelva a iniciar sesión.';
        case 404:
            return 'No se encontró la información solicitada. Es posible que haya sido eliminada.';
        case 408:
        case 504:
            return 'La operación tardó demasiado, probablemente por la señal. Intente de nuevo.';
        case 500:
        case 502:
        case 503:
            return 'Hubo un problema en el servidor. Espere un momento e intente de nuevo.';
    }

    // 4. Error no-HTTP (p. ej. de JavaScript) con su propio mensaje.
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;

    return fallback;
}
