export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        roleId: number;
      };
      /**
       * Cliente autorizado por un token del catálogo público. No es una
       * sesión de usuario: no tiene rol ni habilita endpoints internos.
       */
      publicClient?: {
        id: number;
        priceListId: number;
        nombreComercial: string;
      };
    }
  }
}
