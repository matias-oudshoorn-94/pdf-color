import { ContactModel } from './resources.js';

/** Datos de contacto (whatsapp, email, etc.), cacheados en memoria. */
export const contact = {
  data: null,

  async load() {
    try {
      const { contact: info } = await ContactModel.info();
      this.data = info;
    } catch {
      this.data = null;
    }
    return this.data;
  },
};
