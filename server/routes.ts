import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, warnings, punishments, warningLevels, rules, discordSettings, openaiSettings, aiPromptTemplates, aiPromptHistory, punishmentRules, insertRuleSchema } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { setupDiscordBot } from "./services/discord";
import { testOpenAIConnection } from "./services/openai";
import { analyzeMessage } from "./services/moderation";
import { validateDiscordToken } from "./services/discord";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Set up authentication routes and middleware
  setupAuth(app);

  // protect all routes after this middleware
  app.use("/api", (req, res, next) => {
    // Skip auth check for these endpoints
    if (req.path === "/login" || req.path === "/register" || req.path === "/user") {
      return next();
    }

    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    next();
  });

  // Get Discord settings
  app.get("/api/settings/discord", async (_req, res) => {
    const settings = await db.query.discordSettings.findFirst({
      orderBy: (discordSettings, { desc }) => [desc(discordSettings.createdAt)],
    });

    if (!settings) {
      return res.json({
        status: "disconnected",
      });
    }

    // Don't send the actual token back to the client
    return res.json({
      guildId: settings.guildId,
      status: settings.status,
      error: settings.error,
    });
  });

  // Update Discord settings
  app.post("/api/settings/discord", async (req, res) => {
    const { botToken, guildId } = req.body;

    if (!botToken || !guildId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Validate token first
      const validation = await validateDiscordToken(botToken);
      if (!validation.valid) {
        return res.status(400).json({
          message: validation.error || "Invalid Discord bot token"
        });
      }

      // Delete any existing settings
      await db.delete(discordSettings);

      // Insert new settings
      const settings = await db.insert(discordSettings)
        .values({
          botToken,
          guildId,
          status: "connecting",
        })
        .returning();

      // Try to connect to Discord
      const setup = await setupDiscordBot(botToken);

      if (setup.success) {
        await db.update(discordSettings)
          .set({
            status: "connected",
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(discordSettings.id, settings[0].id));

        return res.json({
          guildId,
          status: "connected",
        });
      } else {
        await db.update(discordSettings)
          .set({
            status: "error",
            error: setup.error,
            updatedAt: new Date(),
          })
          .where(eq(discordSettings.id, settings[0].id));

        return res.status(500).json({ message: setup.error });
      }
    } catch (error: any) {
      console.error("Discord settings update error:", error);
      return res.status(500).json({
        message: error.message || "Failed to update Discord settings"
      });
    }
  });

  // Check Discord connection status
  app.post("/api/settings/discord/status", async (_req, res) => {
    const settings = await db.query.discordSettings.findFirst({
      orderBy: (discordSettings, { desc }) => [desc(discordSettings.createdAt)],
    });

    if (!settings) {
      return res.status(404).json({ message: "Discord bot not configured" });
    }

    try {
      // Pass the token to setupDiscordBot
      const setup = await setupDiscordBot(settings.botToken);

      if (setup.success) {
        await db.update(discordSettings)
          .set({
            status: "connected",
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(discordSettings.id, settings.id));

        return res.json({
          status: "connected",
        });
      } else {
        await db.update(discordSettings)
          .set({
            status: "error",
            error: setup.error,
            updatedAt: new Date(),
          })
          .where(eq(discordSettings.id, settings.id));

        return res.status(500).json({ message: setup.error });
      }
    } catch (error: any) {
      console.error("Discord connection status error:", error);
      await db.update(discordSettings)
        .set({
          status: "error",
          error: error.message,
          updatedAt: new Date(),
        })
        .where(eq(discordSettings.id, settings.id));

      return res.status(500).json({ message: error.message });
    }
  });

  // Get OpenAI settings
  app.get("/api/settings/openai", async (_req, res) => {
    const settings = await db.query.openaiSettings.findFirst({
      orderBy: (openaiSettings, { desc }) => [desc(openaiSettings.createdAt)],
    });

    if (!settings) {
      return res.json({
        status: "disconnected",
      });
    }

    // Don't send the actual key back to the client
    return res.json({
      status: settings.status,
      error: settings.error,
    });
  });

  // Update OpenAI settings
  app.post("/api/settings/openai", async (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Delete any existing settings
      await db.delete(openaiSettings);

      // Insert new settings
      const settings = await db.insert(openaiSettings)
        .values({
          apiKey,
          status: "disconnected",
        })
        .returning();

      // Test the connection
      try {
        await testOpenAIConnection();

        await db.update(openaiSettings)
          .set({
            status: "connected",
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(openaiSettings.id, settings[0].id));

        return res.json({
          status: "connected",
        });
      } catch (error: any) {
        await db.update(openaiSettings)
          .set({
            status: "error",
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(openaiSettings.id, settings[0].id));

        return res.status(500).json({ message: error.message });
      }
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Check OpenAI connection status
  app.post("/api/settings/openai/status", async (_req, res) => {
    const settings = await db.query.openaiSettings.findFirst({
      orderBy: (openaiSettings, { desc }) => [desc(openaiSettings.createdAt)],
    });

    if (!settings) {
      return res.status(404).json({ message: "OpenAI API not configured" });
    }

    try {
      await testOpenAIConnection();

      await db.update(openaiSettings)
        .set({
          status: "connected",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(openaiSettings.id, settings.id));

      return res.json({
        status: "connected",
      });
    } catch (error: any) {
      await db.update(openaiSettings)
        .set({
          status: "error",
          error: error.message,
          updatedAt: new Date(),
        })
        .where(eq(openaiSettings.id, settings.id));

      return res.status(500).json({ message: error.message });
    }
  });

  // Get all warning levels with their rules
  app.get("/api/warning-levels", async (_req, res) => {
    const levels = await db.query.warningLevels.findMany({
      with: {
        rules: {
          orderBy: (rules, { asc }) => [asc(rules.order)],
        },
      },
      orderBy: (warningLevels, { asc }) => [asc(warningLevels.points)],
    });
    res.json(levels);
  });

  // Create a warning level
  app.post("/api/warning-levels", async (req, res) => {
    const { name, color, points, deleteMessage, description } = req.body;

    if (!name || !color || typeof points !== "number" || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const warningLevel = await db.insert(warningLevels)
      .values({
        name,
        color,
        points,
        deleteMessage: !!deleteMessage,
        description,
      })
      .returning();

    res.json(warningLevel[0]);
  });

  // Update a warning level
  app.put("/api/warning-levels/:id", async (req, res) => {
    const { id } = req.params;
    const { name, color, points, deleteMessage, description } = req.body;

    if (!name || !color || typeof points !== "number" || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const warningLevel = await db.update(warningLevels)
      .set({
        name,
        color,
        points,
        deleteMessage: !!deleteMessage,
        description,
        updatedAt: new Date(),
      })
      .where(eq(warningLevels.id, parseInt(id)))
      .returning();

    if (!warningLevel.length) {
      return res.status(404).json({ message: "Warning level not found" });
    }

    res.json(warningLevel[0]);
  });

  // Delete a warning level
  app.delete("/api/warning-levels/:id", async (req, res) => {
    const { id } = req.params;

    try {
      // Check if the warning level exists and has warnings
      const warningResults = await db.select({ count: sql<number>`count(*)` })
        .from(warnings)
        .where(eq(warnings.levelId, parseInt(id)));

      const warningCount = warningResults[0].count;

      if (warningCount > 0) {
        return res.status(400).json({
          message: "Cannot delete warning level that has associated warnings. Remove the warnings first."
        });
      }

      await db.delete(warningLevels)
        .where(eq(warningLevels.id, parseInt(id)));

      res.status(204).end();
    } catch (error: any) {
      console.error('Error deleting warning level:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a rule
  app.post("/api/warning-levels/:levelId/rules", async (req, res) => {
    const { levelId } = req.params;
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        message: "Name and description are required"
      });
    }

    try {
      // Get the highest order number for this warning level
      const existingRules = await db.query.rules.findMany({
        where: eq(rules.warningLevelId, parseInt(levelId)),
        orderBy: (rules, { desc }) => [desc(rules.order)],
        limit: 1,
      });

      const nextOrder = existingRules.length ? existingRules[0].order + 1 : 0;

      // Create the rule with the calculated order
      const rule = await db.insert(rules)
        .values({
          name,
          description,
          warningLevelId: parseInt(levelId),
          order: nextOrder,
        })
        .returning();

      res.json(rule[0]);
    } catch (error: any) {
      console.error('Error creating rule:', error);
      return res.status(400).json({
        message: error.message || "Failed to create rule"
      });
    }
  });

  // Update a rule
  app.put("/api/rules/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    try {
      // First get the existing rule to get its warningLevelId
      const existingRule = await db.query.rules.findFirst({
        where: eq(rules.id, parseInt(id))
      });

      if (!existingRule) {
        return res.status(404).json({ message: "Rule not found" });
      }

      // Validate input using our schema
      const validatedData = insertRuleSchema.parse({
        name,
        description,
        warningLevelId: existingRule.warningLevelId,
        order: existingRule.order
      });

      const rule = await db.update(rules)
        .set({
          name: validatedData.name,
          description: validatedData.description,
          updatedAt: new Date(),
        })
        .where(eq(rules.id, parseInt(id)))
        .returning();

      res.json(rule[0]);
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      return res.status(400).json({ message: "Invalid input data" });
    }
  });

  // Delete a rule
  app.delete("/api/rules/:id", async (req, res) => {
    const { id } = req.params;

    await db.delete(rules)
      .where(eq(rules.id, parseInt(id)));

    res.status(204).end();
  });

  // Update rule order
  app.put("/api/warning-levels/:levelId/rules/reorder", async (req, res) => {
    const { levelId } = req.params;
    const { rules: ruleUpdates } = req.body as { rules: { id: number; order: number }[] };

    if (!Array.isArray(ruleUpdates)) {
      return res.status(400).json({ message: "Invalid rules array" });
    }

    // Update each rule's order
    for (const { id, order } of ruleUpdates) {
      await db.update(rules)
        .set({ order })
        .where(and(
          eq(rules.id, id),
          eq(rules.warningLevelId, parseInt(levelId))
        ));
    }

    // Get updated rules
    const updatedRules = await db.query.rules.findMany({
      where: eq(rules.warningLevelId, parseInt(levelId)),
      orderBy: (rules, { asc }) => [asc(rules.order)],
    });

    res.json(updatedRules);
  });

  // Test endpoint for message moderation
  app.post("/api/test/moderate", async (req, res) => {
    const { content, userId, username } = req.body;

    if (!content || !userId || !username) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      console.log('Testing moderation for:', { content, userId, username });

      // Use the moderation service to analyze the message
      const warning = await analyzeMessage(content, []);
      console.log('Moderation result:', warning);

      // If no warning, return early
      if (warning.warningLevel === "none") {
        return res.json({ warningLevel: "none" });
      }

      // Get the warning level from database
      const warningLevel = await db.query.warningLevels.findFirst({
        where: eq(warningLevels.name, warning.warningLevel),
      });

      if (!warningLevel) {
        console.error('Warning level not found:', warning.warningLevel);
        return res.status(500).json({ message: "Warning level not found" });
      }

      // Get or create user
      let user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        await db.insert(users).values({
          id: userId,
          username,
          totalPoints: 0,
        });
        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
      }

      if (!user) {
        return res.status(500).json({ message: "Failed to create user" });
      }

      // Add warning to database
      await db.insert(warnings).values({
        userId,
        levelId: warningLevel.id,
        points: warningLevel.points,
        ruleTriggered: warning.ruleTriggered,
        messageContent: content,
        messageContext: [],
        messageDeleted: warning.deleteMessage,
      });

      // Update user points
      const newTotalPoints = user.totalPoints + warningLevel.points;
      await db.update(users)
        .set({ totalPoints: newTotalPoints })
        .where(eq(users.id, userId));

      console.log('Updated user points:', { userId, newTotal: newTotalPoints });

      // Process any applicable punishments
      const allPunishmentRules = await db.query.punishmentRules.findMany({
        where: eq(punishmentRules.isActive, true),
        orderBy: (rules, { desc }) => [desc(rules.pointThreshold)],
      });

      console.log('Available punishment rules:', allPunishmentRules);

      // Find the highest applicable punishment
      let punishment = null;
      for (const rule of allPunishmentRules) {
        console.log('Checking rule:', { rule, userPoints: newTotalPoints });

        if (newTotalPoints >= rule.pointThreshold) {
          if (rule.type === "ban") {
            await db.update(users)
              .set({ isBanned: true })
              .where(eq(users.id, userId));

            await db.insert(punishments).values({
              userId,
              type: "ban",
              reason: "Exceeded maximum warning points",
            });
            punishment = "ban";
            break;
          } else if (rule.type === "mute" && !user.isMuted) {
            const expiresAt = new Date(Date.now() + (rule.duration || 60) * 60 * 1000);
            await db.update(users)
              .set({ 
                isMuted: true, 
                muteExpiresAt: expiresAt,
                updatedAt: new Date() 
              })
              .where(eq(users.id, userId));

            await db.insert(punishments).values({
              userId,
              type: "mute",
              reason: "Accumulated warning points",
              duration: rule.duration || 60,
              expiresAt,
            });
            punishment = "mute";
            break;
          }
        }
      }

      res.json({
        warningLevel: warning.warningLevel,
        points: warningLevel.points,
        totalPoints: newTotalPoints,
        punishment,
      });
    } catch (error: any) {
      console.error('Error in test moderation:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get warnings with optional user filter
  app.get("/api/warnings", async (req, res) => {
    const { userId } = req.query;

    try {
      const warningsList = await db.query.warnings.findMany({
        with: {
          user: true,
          level: true,
        },
        orderBy: (warnings, { desc }) => [desc(warnings.createdAt)],
        where: userId ? eq(warnings.userId, userId.toString()) : undefined,
      });

      const transformedWarnings = warningsList.map(warning => ({
        id: warning.id,
        userId: warning.userId,
        username: warning.user.username,
        levelId: warning.levelId,
        points: warning.points,
        ruleTriggered: warning.ruleTriggered,
        messageContent: warning.messageContent,
        messageContext: warning.messageContext,
        createdAt: warning.createdAt,
        messageDeleted: warning.messageDeleted,
        messageIgnored: warning.messageIgnored,
        ignoredAt: warning.ignoredAt,
        ignoredBy: warning.ignoredBy,
        ignoreReason: warning.ignoreReason,
        level: {
          name: warning.level.name,
          color: warning.level.color,
        },
      }));

      console.log('Warnings retrieved:', transformedWarnings.length);
      res.json(transformedWarnings);
    } catch (error: any) {
      console.error('Error fetching warnings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Ignore a warning
  app.post("/api/warnings/:id/ignore", async (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Get the warning to be ignored
      const warning = await db.query.warnings.findFirst({
        where: eq(warnings.id, parseInt(id)),
      });

      if (!warning) {
        return res.status(404).json({ message: "Warning not found" });
      }

      // Get current user
      const user = await db.query.users.findFirst({
        where: eq(users.id, warning.userId),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update warning as ignored
      await db.update(warnings)
        .set({
          messageIgnored: true,
          ignoredAt: new Date(),
          ignoredBy: userId,
          ignoreReason: reason,
        })
        .where(eq(warnings.id, parseInt(id)));

      // Calculate new total points by subtracting the ignored warning's points
      const newTotalPoints = user.totalPoints - warning.points;

      // Update user's total points
      await db.update(users)
        .set({ totalPoints: newTotalPoints })
        .where(eq(users.id, user.id));

      // Get applicable punishment rules ordered by point threshold
      const existingPunishmentRules = await db.query.punishmentRules.findMany({
        where: eq(punishmentRules.isActive, true),
        orderBy: (rules, { desc }) => [desc(rules.pointThreshold)],
      });

      // Check if any punishments should be removed based on new point total
      let shouldRemoveBan = user.isBanned;
      let shouldRemoveMute = user.isMuted;

      // Find the highest applicable punishment for the new point total
      for (const rule of existingPunishmentRules) {
        if (newTotalPoints >= rule.pointThreshold) {
          if (rule.type === "ban") {
            shouldRemoveBan = false;
            break;
          } else if (rule.type === "mute") {
            shouldRemoveMute = false;
            break;
          }
        }
      }

      // Update user status if punishments should be removed
      if (shouldRemoveBan || shouldRemoveMute) {
        await db.update(users)
          .set({
            isBanned: !shouldRemoveBan ? user.isBanned : false,
            isMuted: !shouldRemoveMute ? user.isMuted : false,
            muteExpiresAt: !shouldRemoveMute ? user.muteExpiresAt : null,
          })
          .where(eq(users.id, user.id));
      }

      // Get the updated warning with user data
      const updatedWarning = await db.query.warnings.findFirst({
        where: eq(warnings.id, parseInt(id)),
        with: {
          user: true,
          level: true,
        },
      });

      if (!updatedWarning) {
        return res.status(404).json({ message: "Warning not found after update" });
      }

      // Transform the warning data to match the expected format
      const transformedWarning = {
        id: updatedWarning.id,
        userId: updatedWarning.userId,
        username: updatedWarning.user.username,
        levelId: updatedWarning.levelId,
        points: updatedWarning.points,
        ruleTriggered: updatedWarning.ruleTriggered,
        messageContent: updatedWarning.messageContent,
        messageContext: updatedWarning.messageContext,
        createdAt: updatedWarning.createdAt,
        messageDeleted: updatedWarning.messageDeleted,
        messageIgnored: updatedWarning.messageIgnored,
        ignoredAt: updatedWarning.ignoredAt,
        ignoredBy: updatedWarning.ignoredBy,
        ignoreReason: updatedWarning.ignoreReason,
        level: {
          name: updatedWarning.level.name,
          color: updatedWarning.level.color,
        },
      };

      res.json(transformedWarning);
    } catch (error: any) {
      console.error('Error ignoring warning:', error);
      res.status(500).json({ message: error.message });
    }
  });


  // Get user status
  app.get("/api/users/:userId", async (req, res) => {
    const { userId } = req.params;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  });

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const usersList = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.totalPoints)],
      });

      // Get warning counts for each user
      const usersWithWarnings = await Promise.all(
        usersList.map(async (user) => {
          const userWarnings = await db.query.warnings.findMany({
            where: eq(warnings.userId, user.id),
          });

          return {
            ...user,
            warningCount: userWarnings.length,
            activeWarnings: userWarnings.filter(w => !w.messageIgnored).length,
          };
        })
      );

      res.json(usersWithWarnings);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all prompt templates
  app.get("/api/prompt-templates", async (_req, res) => {
    const templates = await db.query.aiPromptTemplates.findMany({
      orderBy: (templates, { desc }) => [desc(templates.updatedAt)],
    });
    res.json(templates);
  });

  // Get active prompt template
  app.get("/api/prompt-templates/active", async (_req, res) => {
    const template = await db.query.aiPromptTemplates.findFirst({
      where: eq(aiPromptTemplates.isActive, true),
      orderBy: (templates, { desc }) => [desc(templates.updatedAt)],
    });

    if (!template) {
      return res.status(404).json({ message: "No active template found" });
    }

    res.json(template);
  });

  // Create new prompt template
  app.post("/api/prompt-templates", async (req, res) => {
    const { name, systemPrompt, isActive } = req.body;

    if (!name || !systemPrompt) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // If this template should be active, deactivate all others
    if (isActive) {
      await db.update(aiPromptTemplates)
        .set({ isActive: false })
        .where(eq(aiPromptTemplates.isActive, true));
    }

    const template = await db.insert(aiPromptTemplates)
      .values({
        name,
        systemPrompt,
        isActive: !!isActive,
      })
      .returning();

    // Add to history
    await db.insert(aiPromptHistory)
      .values({
        templateId: template[0].id,
        systemPrompt,
        reason: "Initial template creation",
      });

    res.json(template[0]);
  });

  // Update prompt template
  app.put("/api/prompt-templates/:id", async (req, res) => {
    const { id } = req.params;
    const { name, systemPrompt, isActive } = req.body;
    const reason = req.body.reason || "Template update";

    if (!name || !systemPrompt) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // If this template should be active, deactivate all others
    if (isActive) {
      await db.update(aiPromptTemplates)
        .set({ isActive: false })
        .where(eq(aiPromptTemplates.isActive, true));
    }

    const template = await db.update(aiPromptTemplates)
      .set({
        name,
        systemPrompt,
        isActive: !!isActive,
        updatedAt: new Date(),
      })
      .where(eq(aiPromptTemplates.id, parseInt(id)))
      .returning();

    if (!template.length) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Add to history
    await db.insert(aiPromptHistory)
      .values({
        templateId: template[0].id,
        systemPrompt,
        reason,
      });

    res.json(template[0]);
  });

  // Get template history
  app.get("/api/prompt-templates/:id/history", async (req, res) => {
    const { id } = req.params;
    const history = await db.query.aiPromptHistory.findMany({
      where: eq(aiPromptHistory.templateId, parseInt(id)),
      orderBy: (history, { desc }) => [desc(history.createdAt)],
    });

    res.json(history);
  });

  // Set active template
  app.post("/api/prompt-templates/:id/activate", async (req, res) => {
    const { id } = req.params;

    // Deactivate all templates
    await db.update(aiPromptTemplates)
      .set({ isActive: false })
      .where(eq(aiPromptTemplates.isActive, true));

    // Activate the selected template
    const template = await db.update(aiPromptTemplates)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(aiPromptTemplates.id, parseInt(id)))
      .returning();

    if (!template.length) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template[0]);
  });

  // Get punishment rules
  app.get("/api/punishment-rules", async (_req, res) => {
    const rules = await db.query.punishmentRules.findMany({
      orderBy: (punishmentRules, { asc }) => [asc(punishmentRules.pointThreshold)],
    });
    res.json(rules);
  });

  // Create punishment rule
  app.post("/api/punishment-rules", async (req, res) => {
    const { type, pointThreshold, duration } = req.body;

    if (!type || typeof pointThreshold !== "number" || (type === "mute" && typeof duration !== "number")) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["ban", "mute"].includes(type)) {
      return res.status(400).json({ message: "Invalid punishment type" });
    }

    const rule = await db.insert(punishmentRules)
      .values({
        type,
        pointThreshold,
        duration: type === "mute" ? duration : null,
        isActive: true,
      })
      .returning();

    res.json(rule[0]);
  });

  // Update punishment rule
  app.put("/api/punishment-rules/:id", async (req, res) => {
    const { id } = req.params;
    const { type, pointThreshold, duration, isActive } = req.body;

    if (!type || typeof pointThreshold !== "number" || (type === "mute" && typeof duration !== "number")) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["ban", "mute"].includes(type)) {
      return res.status(400).json({ message: "Invalid punishment type" });
    }

    const rule = awaitdb.update(punishmentRules)
      .set({
        type,
        pointThreshold,
        duration: type === "mute" ? duration : null,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(punishmentRules.id, parseInt(id)))
      .returning();

    if (!rule.length) {
            return res.status(404).json({ message: "Rule not found" });
    }

    res.json(rule[0]);
  });

  // Delete punishment rule
  app.delete("/api/punishment-rules/:id", async (req, res) => {
    const { id } = req.params;

    await db.delete(punishmentRules)
      .where(eq(punishmentRules.id, parseInt(id)));

    res.status(204).end();
  });

  // Get user points
  app.post("/api/users/:userId/recalculate", async (req, res) => {
    const { userId } = req.params;

    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all non-ignored warnings
      const userWarnings = await db.query.warnings.findMany({
        where: and(
          eq(warnings.userId, userId),
          eq(warnings.messageIgnored, false)
        ),
      });

      // Calculate total points
      const newTotalPoints = userWarnings.reduce((sum, warning) => sum + warning.points, 0);

      // Get applicable punishment rules ordered by point threshold
      const allPunishmentRules = await db.query.punishmentRules.findMany({
        where: eq(punishmentRules.isActive, true),
        orderBy: (rules, { desc }) => [desc(rules.pointThreshold)],
      });

      // Check if any punishments should be applied based on new point total
      let shouldBeBanned = false;
      let shouldBeMuted = false;
      let muteExpiresAt = null;

      // Find the highest applicable punishment for the new point total
      for (const rule of allPunishmentRules) {
        if (newTotalPoints >= rule.pointThreshold) {
          if (rule.type === "ban") {
            shouldBeBanned = true;
            break;
          } else if (rule.type === "mute") {
            shouldBeMuted = true;
            muteExpiresAt = new Date(Date.now() + (rule.duration || 60) * 60 * 1000);
          }
        }
      }

      // Update user status based on punishment rules
      const updatedUser = await db.update(users)
        .set({
          totalPoints: newTotalPoints,
          isBanned: shouldBeBanned,
          isMuted: shouldBeMuted,
          muteExpiresAt: shouldBeMuted ? muteExpiresAt : null,
        })
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser[0]);
    } catch (error: any) {
      console.error("Error recalculating user points:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reset user warnings
  app.post("/api/users/:userId/reset-warnings", async (req, res) => {
    const { userId } = req.params;

    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Mark all warnings as ignored for testing purposes
      await db.update(warnings)
        .set({
          messageIgnored: true,
          ignoredAt: new Date(),
          ignoredBy: "system",
          ignoreReason: "Reset for testing purposes",
        })
        .where(eq(warnings.userId, userId));

      // Reset user's total points
      await db.update(users)
        .set({
          totalPoints: 0,
          isBanned: false,
          isMuted: false,
          muteExpiresAt: null,
        })
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error resetting warnings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}