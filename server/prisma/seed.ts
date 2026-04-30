import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clean existing data
    await prisma.bitacoraActividad.deleteMany();
    await prisma.bitacora.deleteMany();
    await prisma.folioControl.deleteMany();
    await prisma.festivoColombia.deleteMany();
    await prisma.usuarioTorre.deleteMany();
    await prisma.usuarioProyecto.deleteMany();
    await prisma.contratista.deleteMany();
    await prisma.torre.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.proyecto.deleteMany();

    const passwordHash = await bcrypt.hash('AED2024!', 12);

    // Projects
    const baiaKristal = await prisma.proyecto.create({
        data: { nombre: 'Baia Kristal', ciudad: 'Cartagena', direccion: 'Carrera 3 #8-129, Bocagrande, Cartagena', activo: true },
    });
    const alegraParque = await prisma.proyecto.create({
        data: { nombre: 'Alegra Parque Residencial', ciudad: 'Bogotá', direccion: 'Calle 127 #7-35, Usaquén, Bogotá', activo: true },
    });
    const matimba = await prisma.proyecto.create({
        data: { nombre: 'Matimba', ciudad: 'Barranquilla', direccion: 'Calle 84 #51B-35, Alto Prado, Barranquilla', activo: true },
    });

    console.log('✅ Proyectos creados');

    // Torres for Baia Kristal
    const torreNames = [
        'ETAPA 3 - KALA 1', 'ETAPA 3 - KALA 2', 'ETAPA 3 - KALA 3', 'ETAPA 3 - KALA 4',
        'ETAPA 3 - KALIZA 1', 'ETAPA 3 - KALIZA 2', 'ETAPA 3 - KALIZA 3',
    ];
    const torres: any = {};
    for (const name of torreNames) {
        torres[name] = await prisma.torre.create({
            data: { nombre: name, proyectoId: baiaKristal.id },
        });
    }
    console.log('✅ Torres creadas');

    // Users
    const carlos = await prisma.usuario.create({
        data: {
            nombre: 'Carlos', apellido: 'Mendoza', cedula: '10234567',
            cargo: 'Residente Jefe', email: 'residente@aed.com',
            passwordHash, tipoUsuario: 'residente_obra',
        },
    });
    const luisa = await prisma.usuario.create({
        data: {
            nombre: 'Luisa', apellido: 'Herrera', cedula: '20345678',
            cargo: 'Residente Auxiliar', email: 'residente2@aed.com',
            passwordHash, tipoUsuario: 'residente_obra',
        },
    });
    const roberto = await prisma.usuario.create({
        data: {
            nombre: 'Roberto', apellido: 'Gómez', cedula: '30456789',
            cargo: 'Director de Obra', email: 'director@aed.com',
            passwordHash, tipoUsuario: 'director_obra',
        },
    });
    const maria = await prisma.usuario.create({
        data: {
            nombre: 'María', apellido: 'Castillo', cedula: '40567890',
            cargo: 'Interventora Senior', email: 'interventor@aed.com',
            passwordHash, tipoUsuario: 'interventoria',
        },
    });
    const andres = await prisma.usuario.create({
        data: {
            nombre: 'Andrés', apellido: 'Ramírez', cedula: '50678901',
            cargo: 'Administrador TI', email: 'admin@aed.com',
            passwordHash, tipoUsuario: 'admin',
        },
    });
    console.log('✅ Usuarios creados');

    // User-Project assignments
    await prisma.usuarioProyecto.createMany({
        data: [
            { usuarioId: carlos.id, proyectoId: baiaKristal.id },
            { usuarioId: luisa.id, proyectoId: baiaKristal.id },
            { usuarioId: roberto.id, proyectoId: baiaKristal.id },
            { usuarioId: roberto.id, proyectoId: alegraParque.id },
            { usuarioId: maria.id, proyectoId: baiaKristal.id },
            { usuarioId: andres.id, proyectoId: baiaKristal.id },
            { usuarioId: andres.id, proyectoId: alegraParque.id },
            { usuarioId: andres.id, proyectoId: matimba.id },
        ],
    });

    // User-Torre assignments
    await prisma.usuarioTorre.createMany({
        data: [
            { usuarioId: carlos.id, torreId: torres['ETAPA 3 - KALA 1'].id },
            { usuarioId: carlos.id, torreId: torres['ETAPA 3 - KALA 2'].id },
            { usuarioId: luisa.id, torreId: torres['ETAPA 3 - KALIZA 1'].id },
            { usuarioId: luisa.id, torreId: torres['ETAPA 3 - KALIZA 2'].id },
            { usuarioId: roberto.id, torreId: torres['ETAPA 3 - KALA 1'].id },
            { usuarioId: roberto.id, torreId: torres['ETAPA 3 - KALA 2'].id },
            { usuarioId: roberto.id, torreId: torres['ETAPA 3 - KALIZA 1'].id },
            { usuarioId: maria.id, torreId: torres['ETAPA 3 - KALA 1'].id },
            { usuarioId: maria.id, torreId: torres['ETAPA 3 - KALA 2'].id },
            { usuarioId: maria.id, torreId: torres['ETAPA 3 - KALIZA 1'].id },
            { usuarioId: maria.id, torreId: torres['ETAPA 3 - KALIZA 2'].id },
            // Admin gets all towers
            ...torreNames.map(name => ({ usuarioId: andres.id, torreId: torres[name].id })),
        ],
    });
    console.log('✅ Asignaciones de usuario-proyecto y usuario-torre creadas');

    // Contractors for Baia Kristal
    const contractorNames = [
        'Construcciones López S.A.S', 'Eléctricos del Norte Ltda',
        'Instalaciones Hidráulicas Bogotá', 'Acabados Premium Colombia',
        'Transportes y Grúas Andinas',
    ];
    const contratistas: any = {};
    for (const name of contractorNames) {
        contratistas[name] = await prisma.contratista.create({
            data: { nombre: name, proyectoId: baiaKristal.id },
        });
    }
    console.log('✅ Contratistas creados');

    // Helper dates
    const today = new Date();
    const daysAgo = (n: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - n);
        return d.toISOString().split('T')[0];
    };
    const lastSunday = () => {
        const d = new Date(today);
        d.setDate(d.getDate() - d.getDay());
        if (d.toISOString().split('T')[0] === today.toISOString().split('T')[0]) {
            d.setDate(d.getDate() - 7);
        }
        return d.toISOString().split('T')[0];
    };

    const firmaCarlos = JSON.stringify({ nombre: 'Carlos Mendoza', email: 'residente@aed.com', cedula: '10234567', cargo: 'Residente Jefe' });
    const firmaLuisa = JSON.stringify({ nombre: 'Luisa Herrera', email: 'residente2@aed.com', cedula: '20345678', cargo: 'Residente Auxiliar' });
    const firmaRoberto = JSON.stringify({ nombre: 'Roberto Gómez', email: 'director@aed.com', cedula: '30456789', cargo: 'Director de Obra' });
    const firmaMaria = JSON.stringify({ nombre: 'María Castillo', email: 'interventor@aed.com', cedula: '40567890', cargo: 'Interventora Senior' });

    // Registro 1 — completado
    const bit1 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALA 1'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 1,
            fechaRegistro: daysAgo(3),
            horaRegistro: '08:30:00',
            estadoDiligencia: 'completado',
            estadoObra: 'normal',
            diaLaborable: true,
            creadoPorUsuarioId: carlos.id,
            firmaResidenteData: firmaCarlos,
            firmaResidenteTimestamp: new Date(daysAgo(3)),
            firmaDirectorData: firmaRoberto,
            firmaDirectorTimestamp: new Date(daysAgo(3)),
            firmaInterventorData: firmaMaria,
            firmaInterventorTimestamp: new Date(daysAgo(3)),
        },
    });
    await prisma.bitacoraActividad.create({
        data: {
            bitacoraId: bit1.id,
            actividadEjecutada: 'Fundición de columnas nivel 4',
            porcentajeCompletado: 60,
            contratistaId: contratistas['Construcciones López S.A.S'].id,
            trabajadoresEnObra: 12,
            horasTrabajadas: 7,
            climaManana: 'soleado',
            climaTarde: 'nublado',
            notasGenerales: 'Se completó sin contratiempos. Material suficiente en sitio.',
        },
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALA 1'].id, fecha: daysAgo(3), numeroFolio: 1 } });

    // Registro 2 — pendiente_interventor
    const bit2 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALA 1'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 2,
            fechaRegistro: daysAgo(2),
            horaRegistro: '09:00:00',
            estadoDiligencia: 'pendiente_interventor',
            estadoObra: 'normal',
            diaLaborable: true,
            creadoPorUsuarioId: carlos.id,
            firmaResidenteData: firmaCarlos,
            firmaResidenteTimestamp: new Date(daysAgo(2)),
            firmaDirectorData: firmaRoberto,
            firmaDirectorTimestamp: new Date(daysAgo(2)),
        },
    });
    await prisma.bitacoraActividad.createMany({
        data: [
            {
                bitacoraId: bit2.id,
                actividadEjecutada: 'Instalación de formaleta nivel 5',
                porcentajeCompletado: 45,
                contratistaId: contratistas['Construcciones López S.A.S'].id,
                trabajadoresEnObra: 8,
                horasTrabajadas: 6,
                climaManana: 'nublado',
                climaTarde: 'lluvia',
                notasGenerales: 'Se retrasó 1 hora por lluvia en la tarde.',
            },
            {
                bitacoraId: bit2.id,
                actividadEjecutada: 'Descimbrado nivel 3',
                porcentajeCompletado: 80,
                contratistaId: contratistas['Acabados Premium Colombia'].id,
                trabajadoresEnObra: 5,
                horasTrabajadas: 4,
                climaManana: 'nublado',
                climaTarde: 'lluvia',
                notasGenerales: 'Avance según programación.',
            },
        ],
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALA 1'].id, fecha: daysAgo(2), numeroFolio: 2 } });

    // Registro 3 — pendiente_director
    const bit3 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALA 2'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 1,
            fechaRegistro: daysAgo(2),
            horaRegistro: '07:45:00',
            estadoDiligencia: 'pendiente_director',
            estadoObra: 'retrasada',
            diaLaborable: true,
            creadoPorUsuarioId: carlos.id,
            firmaResidenteData: firmaCarlos,
            firmaResidenteTimestamp: new Date(daysAgo(2)),
            firmaInterventorData: firmaMaria,
            firmaInterventorTimestamp: new Date(daysAgo(2)),
        },
    });
    await prisma.bitacoraActividad.create({
        data: {
            bitacoraId: bit3.id,
            actividadEjecutada: 'Vaciado de losa nivel 2',
            porcentajeCompletado: 30,
            contratistaId: contratistas['Construcciones López S.A.S'].id,
            trabajadoresEnObra: 15,
            horasTrabajadas: 7,
            climaManana: 'soleado',
            climaTarde: 'soleado',
            notasGenerales: 'Retraso por falta de material. Se solicitó reabastecimiento urgente.',
        },
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALA 2'].id, fecha: daysAgo(2), numeroFolio: 1 } });

    // Registro 4 — pendiente_ambos
    const bit4 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALIZA 1'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 1,
            fechaRegistro: daysAgo(1),
            horaRegistro: '08:00:00',
            estadoDiligencia: 'pendiente_ambos',
            estadoObra: 'avanzada',
            diaLaborable: true,
            creadoPorUsuarioId: luisa.id,
            firmaResidenteData: firmaLuisa,
            firmaResidenteTimestamp: new Date(daysAgo(1)),
        },
    });
    await prisma.bitacoraActividad.createMany({
        data: [
            {
                bitacoraId: bit4.id,
                actividadEjecutada: 'Instalación eléctrica piso 3',
                porcentajeCompletado: 70,
                contratistaId: contratistas['Eléctricos del Norte Ltda'].id,
                trabajadoresEnObra: 6,
                horasTrabajadas: 7,
                climaManana: 'soleado',
                climaTarde: 'soleado',
                notasGenerales: 'Buen avance en cableado y puntos eléctricos.',
            },
            {
                bitacoraId: bit4.id,
                actividadEjecutada: 'Instalación de tubería hidráulica piso 2',
                porcentajeCompletado: 55,
                contratistaId: contratistas['Instalaciones Hidráulicas Bogotá'].id,
                trabajadoresEnObra: 4,
                horasTrabajadas: 6,
                climaManana: 'soleado',
                climaTarde: 'nublado',
                notasGenerales: 'Se completaron las bajantes del piso 2.',
            },
            {
                bitacoraId: bit4.id,
                actividadEjecutada: 'Transporte de materiales al sitio',
                porcentajeCompletado: 100,
                contratistaId: contratistas['Transportes y Grúas Andinas'].id,
                trabajadoresEnObra: 3,
                horasTrabajadas: 5,
                climaManana: 'soleado',
                climaTarde: 'nublado',
                notasGenerales: 'Se entregaron 200 sacos de cemento y 50 varillas.',
            },
        ],
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALIZA 1'].id, fecha: daysAgo(1), numeroFolio: 1 } });

    // Registro 5 — nuevo (domingo no laboral)
    const bit5 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALA 3'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 1,
            fechaRegistro: lastSunday(),
            horaRegistro: '10:00:00',
            estadoDiligencia: 'pendiente_ambos',
            estadoObra: null,
            diaLaborable: false,
            razonNoLaboral: 'domingo',
            explicacionNoLaboral: 'Día de descanso según ley colombiana',
            creadoPorUsuarioId: carlos.id,
            firmaResidenteData: firmaCarlos,
            firmaResidenteTimestamp: new Date(lastSunday()),
        },
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALA 3'].id, fecha: lastSunday(), numeroFolio: 1 } });

    // Registro 6 — creado por director (sin residente)
    const bit6 = await prisma.bitacora.create({
        data: {
            torreId: torres['ETAPA 3 - KALA 4'].id,
            proyectoId: baiaKristal.id,
            numeroFolio: 1,
            fechaRegistro: daysAgo(4),
            horaRegistro: '07:30:00',
            estadoDiligencia: 'pendiente_interventor',
            estadoObra: 'detenida',
            diaLaborable: true,
            creadoPorUsuarioId: roberto.id,
            omitirFirmaResidente: true,
            firmaDirectorData: firmaRoberto,
            firmaDirectorTimestamp: new Date(daysAgo(4)),
        },
    });
    await prisma.bitacoraActividad.create({
        data: {
            bitacoraId: bit6.id,
            actividadEjecutada: 'Inspección estructural por daño reportado',
            porcentajeCompletado: 100,
            contratistaId: contratistas['Construcciones López S.A.S'].id,
            trabajadoresEnObra: 2,
            horasTrabajadas: 3,
            climaManana: 'soleado',
            climaTarde: 'soleado',
            notasGenerales: 'Se identificó fisura en columna C-4. Se detuvo la obra para evaluación.',
        },
    });
    await prisma.folioControl.create({ data: { torreId: torres['ETAPA 3 - KALA 4'].id, fecha: daysAgo(4), numeroFolio: 1 } });

    // Sync holidays
    try {
        const year = new Date().getFullYear();
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`);
        if (response.ok) {
            const holidays = await response.json() as Array<{ date: string; localName: string }>;
            for (const h of holidays) {
                await prisma.festivoColombia.upsert({
                    where: { fecha: h.date },
                    create: { fecha: h.date, nombre: h.localName, anio: year },
                    update: { nombre: h.localName, anio: year },
                });
            }
            console.log(`✅ ${holidays.length} festivos sincronizados para ${year}`);
        }
    } catch (e) {
        console.log('⚠️  No se pudieron sincronizar festivos (sin conexión a internet)');
    }

    console.log('🎉 Seed completado exitosamente');
}

main()
    .catch(console.error)
    .finally(async () => { await prisma.$disconnect(); });
