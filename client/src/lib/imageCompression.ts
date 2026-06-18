// Comprime/redimensiona imágenes en el navegador ANTES de subirlas.
//
// Motivación: en obra la señal es débil y las fotos de celular pesan 5-12MB. Subir
// archivos así fallaba (rechazo por tamaño >5MB en el servidor, formatos .heic de iPhone,
// o cortes de red), y el usuario solo veía "Error al guardar". Al reducir a ~1920px y
// recodificar a JPEG el peso baja a ~300-500KB, y de paso se normaliza el formato a JPEG.
//
// La función SIEMPRE es tolerante a fallos: si el navegador no puede decodificar la imagen
// (p. ej. un .heic en un navegador que no lo soporta), devuelve el archivo original tal cual.

const MAX_DIMENSION = 1920;
const QUALITY = 0.7;

interface CompressOptions {
    maxDimension?: number;
    quality?: number;
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
    // Solo procesamos imágenes; cualquier otra cosa se devuelve intacta.
    if (!file.type.startsWith('image/')) return file;

    const maxDimension = opts.maxDimension ?? MAX_DIMENSION;
    const quality = opts.quality ?? QUALITY;

    try {
        const source = await loadImage(file);
        const srcWidth = (source as HTMLImageElement).naturalWidth || source.width;
        const srcHeight = (source as HTMLImageElement).naturalHeight || source.height;
        if (!srcWidth || !srcHeight) return file;

        const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
        const targetW = Math.round(srcWidth * scale);
        const targetH = Math.round(srcHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

        // Liberar memoria del ImageBitmap si aplica.
        if ('close' in source && typeof (source as ImageBitmap).close === 'function') {
            (source as ImageBitmap).close();
        }

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (!blob) return file;

        // Se aplica a TODAS las imágenes (no solo a las pesadas): siempre se redimensiona a
        // máx. MAX_DIMENSION y se recodifica a JPEG, normalizando formato y tamaño.
        const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
        // Decodificación no soportada (p. ej. HEIC en Chrome) u otro error: usar el original.
        return file;
    }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
    // createImageBitmap respeta la orientación EXIF (fotos de celular suelen venir rotadas).
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        } catch {
            // Caer al método con <img> si el navegador no soporta la opción.
        }
    }
    return await loadImageElement(file);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}
