-- Gastos de ruta. `cash_sessions.total_gastos` existía como columna y se
-- usaba en el arqueo, pero NADA la escribía: no había forma de registrar un
-- gasto. Cualquier gasto real (combustible, viáticos, comida) descuadraba el
-- arqueo sin que el sistema pudiera explicarlo.
--
-- El CHECK impide guardar un gasto negativo o en cero, que solo serviría
-- para inflar el esperado de la caja.

-- CreateTable
CREATE TABLE "cash_expenses" (
    "id" SERIAL NOT NULL,
    "cash_session_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "recibo_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_expenses_monto_positivo" CHECK ("monto" > 0)
);

-- CreateIndex
CREATE INDEX "cash_expenses_cash_session_id_idx" ON "cash_expenses"("cash_session_id");

-- AddForeignKey
ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
