import dotenv from "dotenv"; // Importa dotenv para manejar variables de entorno
import path from "path"; // Importa el módulo path para trabajar con rutas de archivos
import payload, { Payload } from "payload"; // Importa payload, el CMS headless
import type { InitOptions } from "payload/config"; // Importa el tipo InitOptions para tipado TypeScript
import nodemailer from "nodemailer";

dotenv.config({
  // Configura dotenv para cargar variables de entorno
  path: path.resolve(__dirname, "../.env"), // Especifica la ruta del archivo .env
});

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  secure: true,
  port: 465,
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY,
  },
});

let cached = (global as any).payload; // Crea o recupera una caché global para la instancia de Payload

if (!cached) {
  // Si no existe en caché, inicializa un objeto para almacenarlo
  cached = (global as any).payload = {
    client: null,
    promise: null,
  };
}

interface Args {
  // Define una interfaz para los argumentos de getPayloadClient
  initOptions?: Partial<InitOptions>; // Permite pasar opciones de inicialización parciales para Payload
}

export const getPayloadClient = async ({
  initOptions,
}: Args = {}): Promise<Payload> => {
  // Función asíncrona para obtener o inicializar Payload
  if (!process.env.PAYLOAD_SECRET) {
    // Verifica si la variable PAYLOAD_SECRET está configurada
    throw new Error("PAYLOAD_SECRET is missing"); // Si no, lanza un error
  }

  if (cached.client) {
    // Si ya hay un cliente de Payload en caché, lo devuelve
    return cached.client;
  }

  if (!cached.promise) {
    // Si no hay una promesa de inicialización en caché
    cached.promise = payload.init({
      // Inicializa Payload y almacena la promesa
      email: {
        transport: transporter,
        fromAddress: "onboarding@resend.dev",
        fromName: "DigitalHippo",
      },
      secret: process.env.PAYLOAD_SECRET, // Usa la variable de entorno PAYLOAD_SECRET
      local: initOptions?.express ? false : true, // Determina si Payload corre localmente o no
      ...(initOptions || {}), // Esparce las opciones de inicialización adicionales, si existen
    });
  }
  try {
    cached.client = await cached.promise; // Espera a que Payload se inicialice y guarda el cliente en caché
  } catch (e: unknown) {
    cached.promise = null; // Si hay un error, resetea la promesa en caché
    throw e; // Y lanza el error
  }

  return cached.client; // Devuelve el cliente de Payload
};
