const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Creando proyecto Baia Kristal...');

    const proyecto = await prisma.proyecto.upsert({
        where: { id: 'baia-kristal' },
        update: {},
        create: {
            id: 'baia-kristal',
            nombre: 'Baia Kristal',
            ciudad: 'Cartagena',
            direccion: 'Carrera 3 #8-129, Bocagrande, Cartagena',
            activo: true,
        },
    });

    console.log('✅ Proyecto creado:', proyecto.nombre);

    const torreNames = [
        'ETAPA 3 - KALA 1',
        'ETAPA 3 - KALA 2',
        'ETAPA 3 - KALA 3',
        'ETAPA 3 - KALA 4',
        'ETAPA 3 - KALIZA 1',
        'ETAPA 3 - KALIZA 2',
        'ETAPA 3 - KALIZA 3',
    ];

    for (const nombre of torreNames) {
        const torre = await prisma.torre.upsert({
            where: { id: `baia-kristal-${nombre.toLowerCase().replace(/\s+/g, '-')}` },
            update: {},
            create: {
                id: `baia-kristal-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
                nombre,
                proyectoId: proyecto.id,
                activo: true,
            },
        });
        console.log('  ✅ Torre creada:', torre.nombre);
    }

    // Asignar el admin (rgalindo@aed.com.co) al proyecto y todas las torres
    const admin = await prisma.usuario.findUnique({ where: { email: 'rgalindo@aed.com.co' } });

    if (admin) {
        await prisma.usuarioProyecto.upsert({
            where: { usuarioId_proyectoId: { usuarioId: admin.id, proyectoId: proyecto.id } },
            update: {},
            create: { usuarioId: admin.id, proyectoId: proyecto.id },
        });

        const torres = await prisma.torre.findMany({ where: { proyectoId: proyecto.id } });
        for (const torre of torres) {
            await prisma.usuarioTorre.upsert({
                where: { usuarioId_torreId: { usuarioId: admin.id, torreId: torre.id } },
                update: {},
                create: { usuarioId: admin.id, torreId: torre.id },
            });
        }
        console.log('✅ Admin asignado al proyecto y todas las torres');
    } else {
        console.log('⚠️  Admin no encontrado — ejecuta primero create-admin.js');
    }

    console.log('🎉 Seed completado');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
