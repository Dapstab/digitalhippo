import express from "express"; // Importa Express para manejar el servidor HTTP
import { getPayloadClient } from "./get-payload"; // Importa función para inicializar Payload CMS
import { nextApp, nextHandler } from "./next-utils"; // Importa utilidades de Next.js
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc";
import { inferAsyncReturnType } from "@trpc/server";
import bodyParser from "body-parser";
import { IncomingMessage } from "http";
import { stripeWebhookHandler } from "./webhooks";
import nextBuild from "next/dist/build";
import path from "path";
import { PayloadRequest } from "payload/types";
import { parse } from "url";

const app = express(); // Crea una instancia de Express
const PORT = Number(process.env.PORT) || 3000; // Define el puerto del servidor, usa variable de entorno o 3000 por defecto

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({
  req,
  res,
});

export type ExpressContext = inferAsyncReturnType<typeof createContext>;

export type WebhookRequest = IncomingMessage & { rawBody: Buffer };

const start = async () => {
  const webhookMiddleware = bodyParser.json({
    verify: (req: WebhookRequest, _, buffer) => {
      req.rawBody = buffer;
    },
  });

  app.post("/api/webhooks/stripe", webhookMiddleware, stripeWebhookHandler);

  const payload = await getPayloadClient({
    // Inicializa Payload CMS
    initOptions: {
      express: app, // Configura Payload para usar la instancia de Express
      onInit: async (cms) => {
        // Callback después de inicializar Payload
        cms.logger.info(`Admin URL ${cms.getAdminURL()}`); // Muestra la URL del admin de Payload
      },
    },
  }); // payload es la instancia de Payload CMS

  const cartRouter = express.Router();

  cartRouter.use(payload.authenticate);

  cartRouter.get("/", (req, res) => {
    const request = req as PayloadRequest;

    if (!request.user) return res.redirect("/sign-in?origin=cart");

    const parseUrl = parse(req.url, true);

    return nextApp.render(req, res, "/cart", parseUrl.query);
  });

  app.use("cart", cartRouter);

  if (process.env.NEXT_BUILD) {
    app.listen(PORT, async () => {
      payload.logger.info("Next.js is building for production");

      // @ts-expect-error
      await nextBuild(path.join(__dirname, "../"));

      process.exit();
    });

    return;
  }

  app.use(
    "/api/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use((req, res) => nextHandler(req, res)); // Configura el manejador de Next.js para todas las rutas

  // Prepara la aplicación Next.js
  nextApp.prepare().then(() => {
    payload.logger.info("Next.js started");
    // Inicia el servidor en el puerto especificado
    app.listen(PORT, async () => {
      payload.logger.info(
        // Aquí se podría agregar log de inicio del servidor, por ejemplo, mostrando la URL de la app Next.js
        `Next.js App URL: ${process.env.NEXT_PUBLIC_SERVER_URL}`
      );
    });
  });
};

start(); // Ejecuta la función start para iniciar el servidor
