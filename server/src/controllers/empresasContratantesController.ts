import { Request, Response } from 'express';
import { prisma } from '../index';

// Get all empresas contratantes
export const getEmpresasContratantes = async (req: Request, res: Response) => {
  try {
    const empresas = await prisma.empresaContratante.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(empresas);
  } catch (error) {
    console.error('Error fetching empresas contratantes:', error);
    res.status(500).json({ message: 'Error al obtener las empresas contratantes' });
  }
};

// Create a new empresa contratante
export const createEmpresaContratante = async (req: Request, res: Response) => {
  try {
    const { nombre, nit, activo } = req.body;

    const nuevaEmpresa = await prisma.empresaContratante.create({
      data: {
        nombre,
        nit,
        activo: activo ?? true,
      },
    });

    res.status(201).json(nuevaEmpresa);
  } catch (error) {
    console.error('Error creating empresa contratante:', error);
    res.status(500).json({ message: 'Error al crear la empresa contratante' });
  }
};

// Update an existing empresa contratante
export const updateEmpresaContratante = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, nit, activo } = req.body;

    const empresaActualizada = await prisma.empresaContratante.update({
      where: { id },
      data: {
        nombre,
        nit,
        activo,
      },
    });

    res.json(empresaActualizada);
  } catch (error) {
    console.error('Error updating empresa contratante:', error);
    res.status(500).json({ message: 'Error al actualizar la empresa contratante' });
  }
};

// Delete an empresa contratante
export const deleteEmpresaContratante = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if there are projects associated with this company before deleting
    const projectsCount = await prisma.proyecto.count({
      where: { empresaContratanteId: id },
    });

    if (projectsCount > 0) {
      res.status(400).json({
        message: 'No se puede eliminar la empresa porque tiene proyectos asociados. Inactívela en su lugar.'
      });
      return;
    }

    await prisma.empresaContratante.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting empresa contratante:', error);
    res.status(500).json({ message: 'Error al eliminar la empresa contratante' });
  }
};
