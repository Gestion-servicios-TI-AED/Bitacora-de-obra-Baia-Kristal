const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('28C3g@kFuhP3Xhc7', 12);

    const admin = await prisma.usuario.upsert({
        where: { email: 'rgalindo@aed.com.co' },
        update: { passwordHash },
        create: {
            nombre: 'Ruben',
            apellido: 'Galindo',
            cedula: '1143354803',
            cargo: 'Administrador',
            email: 'rgalindo@aed.com.co',
            passwordHash,
            tipoUsuario: 'admin',
            activo: true,
        },
    });

    console.log('✅ Usuario admin creado:', admin.email);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
