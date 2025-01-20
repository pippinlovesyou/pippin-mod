import { db } from "@db";
import { discordSettings, openaiSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { setupDiscordBot } from "./discord";
import { testOpenAIConnection } from "./openai";

export async function initializeServices() {
  console.log("Initializing services...");
  
  try {
    // Initialize Discord
    const discordConfig = await db.query.discordSettings.findFirst({
      orderBy: (discordSettings, { desc }) => [desc(discordSettings.createdAt)],
    });

    if (discordConfig) {
      console.log("Found Discord configuration, attempting to connect...");
      try {
        const setup = await setupDiscordBot(discordConfig.botToken);
        if (setup.success) {
          await db.update(discordSettings)
            .set({
              status: "connected",
              error: null,
              updatedAt: new Date(),
            })
            .where(eq(discordSettings.id, discordConfig.id));
          console.log("Discord connection successful");
        } else {
          await db.update(discordSettings)
            .set({
              status: "error",
              error: setup.error,
              updatedAt: new Date(),
            })
            .where(eq(discordSettings.id, discordConfig.id));
          console.error("Discord connection failed:", setup.error);
        }
      } catch (error: any) {
        await db.update(discordSettings)
          .set({
            status: "error",
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(discordSettings.id, discordConfig.id));
        console.error("Discord connection error:", error);
      }
    } else {
      console.log("No Discord configuration found");
    }

    // Initialize OpenAI
    const openaiConfig = await db.query.openaiSettings.findFirst({
      orderBy: (openaiSettings, { desc }) => [desc(openaiSettings.createdAt)],
    });

    if (openaiConfig) {
      console.log("Found OpenAI configuration, testing connection...");
      try {
        await testOpenAIConnection();
        await db.update(openaiSettings)
          .set({
            status: "connected",
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(openaiSettings.id, openaiConfig.id));
        console.log("OpenAI connection successful");
      } catch (error: any) {
        await db.update(openaiSettings)
          .set({
            status: "error",
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(openaiSettings.id, openaiConfig.id));
        console.error("OpenAI connection error:", error);
      }
    } else {
      console.log("No OpenAI configuration found");
    }
  } catch (error) {
    console.error("Service initialization error:", error);
  }
}
