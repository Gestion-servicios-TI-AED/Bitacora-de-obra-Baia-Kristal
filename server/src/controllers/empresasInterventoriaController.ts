import { Request, Response } from 'express';
import { prisma } from '../index';

// Get all empresas interventoras
export const getEmpresasInterventoria = async (req: Request, res: Response) => {
  try {
    const empresas = await prisma.empresaInterventoria.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(empresas);
  } catch (error) {
    console.error('Error fetching empresas interventoria:', error);
    res.status(500).json({ message: 'Error al obtener las empresas de interventoría' });
  }
};

// Create a new empresa interventora
export const createEmpresaInterventoria = async (req: Request, res: Response) => {
  try {
    const { nombre, nit, activo } = req.body;

    const nuevaEmpresa = await prisma.empresaInterventoria.create({
      data: {
        nombre,
        nit,
        activo: activo ?? true,
      },
    });

    res.status(201).json(nuevaEmpresa);
  } catch (error) {
    console.error('Error creating empresa interventoria:', error);
    res.status(500).json({ message: 'Error al crear la empresa de interventoría' });
  }
};

// Update an existing empresa interventora
export const updateEmpresaInterventoria = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, nit, activo } = req.body;

    const empresaActualizada = await prisma.empresaInterventoria.update({
      where: { id },
      data: {
        nombre,
        nit,
        activo,
      },
    });

    res.json(empresaActualizada);
  } catch (error) {
    console.error('Error updating empresa interventoria:', error);
    res.status(500).json({ message: 'Error al actualizar la empresa de interventoría' });
  }
};

// Delete an empresa interventora
export const deleteEmpresaInterventoria = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Optional: Check if there are users associated with this company before deleting
    const usersCount = await prisma.usuario.count({
      where: { empresaInterventoriaId: id },
    });

    if (usersCount > 0) {
      res.status(400).json({
        message: 'No se puede eliminar la empresa porque tiene usuarios asociados. Inactívela en su lugar.'
      });
      return;
    }

    await prisma.empresaInterventoria.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting empresa interventoria:', error);
    res.status(500).json({ message: 'Error al eliminar la empresa de interventoría' });
  }
};
