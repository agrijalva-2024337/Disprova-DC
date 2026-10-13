-- RemoveCategoryParent
--
-- Se elimina la jerarquía de categorías: el negocio solo necesita categoría
-- plana. Las subcategorías existentes ("Higiene personal", "Bebidas") pasan a
-- ser categorías normales; sus productos no se tocan porque apuntan por
-- `category_id`, no por el padre.

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parent_id_fkey";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "parent_id";
