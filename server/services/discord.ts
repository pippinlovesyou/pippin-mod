import { Client, Events, GatewayIntentBits, Partials, IntentsBitField, PermissionsBitField, ChannelType, Message, TextChannel, DMChannel, NewsChannel, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { analyzeMessage } from "./moderation";
import { db } from "@db";
import { users, warnings, punishments, warningLevels, punishmentRules } from "@db/schema";
import { eq } from "drizzle-orm";

let client: Client | null = null;

// Define required intents and permissions
const REQUIRED_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

const REQUIRED_PERMISSIONS = [
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.ManageMessages,
];

// Helper function to format missing permissions
function formatMissingPermissions(permissions: bigint[]): string {
  return permissions.map(p => {
    const name = Object.entries(PermissionsBitField.Flags)
      .find(([_, value]) => value === p)?.[0];
    return name || p.toString();
  }).join(', ');
}

// Add new error handling utilities
function logError(context: string, error: unknown) {
  console.error(`[Discord Service] ${context}:`, error);
  if (error instanceof Error) {
    console.error('Stack trace:', error.stack);
  }
}

async function safeDeleteMessage(message: Message) {
  try {
    await message.delete();
    return true;
  } catch (error) {
    logError('Failed to delete message', error);
    return false;
  }
}

// Add interface for warning message components
interface WarningComponents {
  row: ActionRowBuilder<ButtonBuilder>;
}

// Create warning message components
function createWarningComponents(): WarningComponents {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_warning')
        .setLabel('Toggle Details')
        .setStyle(ButtonStyle.Secondary)
    );

  return { row };
}

// Create warning embeds
function createWarningEmbeds(params: {
  warningLevel: string;
  userId: string;
  points: number;
  totalPoints: number;
  messageDeleted: boolean;
  ruleTriggered?: string;
  punishment?: string;
}, expanded: boolean = false) {
  const baseEmbed = new EmbedBuilder()
    .setColor(
      params.warningLevel === "red" ? 0xFF0000 :
        params.warningLevel === "orange" ? 0xFFA500 : 0xFFFF00
    )
    .setDescription(
      `${params.messageDeleted ? "*[Message deleted]* " : ""}⚠️ <@${params.userId}> • ${params.points} pts (total: ${params.totalPoints})${params.punishment ? ` • ${params.punishment}` : ""}`
    );

  if (expanded) {
    baseEmbed.addFields(
      { name: 'Warning Level', value: params.warningLevel, inline: true },
      { name: 'Points Added', value: params.points.toString(), inline: true },
      { name: 'Total Points', value: params.totalPoints.toString(), inline: true },
    );

    if (params.ruleTriggered) {
      baseEmbed.addFields({ name: 'Rule Violated', value: params.ruleTriggered });
    }
  }

  return [baseEmbed];
}


// Update the message sending part
async function safeSendWarning(channel: TextChannel | DMChannel | NewsChannel, params: {
  warningLevel: string;
  userId: string;
  points: number;
  totalPoints: number;
  messageDeleted: boolean;
  ruleTriggered?: string;
  punishment?: string;
}) {
  try {
    const components = createWarningComponents();
    const embeds = createWarningEmbeds(params);

    const message = await channel.send({
      embeds,
      components: [components.row]
    });

    // Add button interaction collector
    const collector = message.createMessageComponentCollector({
      time: 300000 // 5 minutes
    });

    let expanded = false;
    collector.on('collect', async interaction => {
      if (!interaction.isButton()) return;

      if (interaction.customId === 'toggle_warning') {
        expanded = !expanded;
        await interaction.update({
          embeds: createWarningEmbeds(params, expanded),
          components: [components.row]
        });
      }
    });

    return message;
  } catch (error) {
    logError('Failed to send warning with embeds', error);
    // Fallback to simple text message
    try {
      const fallbackMessage = `⚠️ Warning: <@${params.userId}> received ${params.points} points (total: ${params.totalPoints})`;
      return await channel.send(fallbackMessage);
    } catch (fallbackError) {
      logError('Failed to send fallback warning message', fallbackError);
      return null;
    }
  }
}

async function safeApplyPunishment(
  member: GuildMember,
  type: "ban" | "mute",
  duration?: number,
  reason?: string
) {
  try {
    console.log('Applying punishment:', { type, duration, userId: member.id });

    if (type === "ban") {
      console.log('Attempting to ban user:', member.id);
      await member.ban({ reason: reason || "Exceeded maximum warning points" });
      console.log('Successfully banned user:', member.id);
      return true;
    } else if (type === "mute") {
      // Discord.js timeout() expects milliseconds, but our duration is stored in hours
      const muteDurationMs = (duration || 60) * 60 * 1000; // Convert hours to milliseconds
      console.log('Attempting to timeout user:', { 
        userId: member.id, 
        durationMs: muteDurationMs,
        originalDurationHours: duration,
        defaultDurationHours: 60 
      });
      await member.timeout(muteDurationMs, reason || "Accumulated warning points");
      console.log('Successfully applied timeout to user:', member.id);
      return true;
    }
  } catch (error) {
    logError(`Failed to apply ${type} punishment`, error);
    console.error('Punishment application error details:', {
      memberId: member.id,
      type,
      duration,
      permissions: member.permissions.toArray()
    });
    return false;
  }
  return false;
}

export async function validateDiscordToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('Creating temporary client for token validation...');
    const tempClient = new Client({
      intents: REQUIRED_INTENTS,
    });

    // Try to login with the token
    await tempClient.login(token);

    // Check bot permissions in the guild
    const guilds = Array.from(tempClient.guilds.cache.values());
    if (guilds.length === 0) {
      await tempClient.destroy();
      return {
        valid: false,
        error: "Bot is not in any servers. Please invite the bot to your server first."
      };
    }

    // Check permissions in each guild
    for (const guild of guilds) {
      const botMember = guild.members.cache.get(tempClient.user.id);
      if (!botMember) continue;

      const missingPermissions = REQUIRED_PERMISSIONS.filter(
        permission => !botMember.permissions.has(permission)
      );

      if (missingPermissions.length > 0) {
        await tempClient.destroy();
        return {
          valid: false,
          error: `Missing required permissions in server ${guild.name}: ${formatMissingPermissions(missingPermissions)}`
        };
      }
    }

    // If login succeeds, destroy the temporary client
    await tempClient.destroy();
    return { valid: true };
  } catch (error) {
    console.error("Discord token validation error:", error);
    if (error instanceof Error) {
      if (error.message.includes("An invalid token was provided")) {
        return { valid: false, error: "The provided Discord bot token is invalid. Please check your token and try again." };
      } else if (error.message.includes("disallowed intents")) {
        return {
          valid: false,
          error: "The bot requires the Message Content Intent. Please go to the Discord Developer Portal, select your bot, go to the 'Bot' section, and enable the 'Message Content Intent' under 'Privileged Gateway Intents'."
        };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: "Failed to validate Discord token" };
  }
}

export async function setupDiscordBot(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    // If there's an existing client, destroy it first
    if (client) {
      console.log('Destroying existing Discord client...');
      await client.destroy();
    }

    console.log('Creating new Discord client with intents:', REQUIRED_INTENTS);
    client = new Client({
      intents: REQUIRED_INTENTS,
      partials: [Partials.Message, Partials.Channel],
    });

    // Set up debug event handlers
    client.on('debug', (info) => {
      console.log('Discord Debug:', info);
    });

    client.on('warn', (info) => {
      console.log('Discord Warning:', info);
    });

    client.on('error', (error) => {
      console.error('Discord Error:', error);
    });

    // Set up ready event handler
    client.once(Events.ClientReady, async c => {
      console.log(`Discord bot ready and connected as ${c.user.tag}`);

      // Check permissions in all guilds
      for (const [guildId, guild] of c.guilds.cache) {
        const botMember = guild.members.cache.get(c.user.id);
        if (!botMember) {
          console.warn(`Could not find bot member in guild ${guild.name} (${guildId})`);
          continue;
        }

        const missingPermissions = REQUIRED_PERMISSIONS.filter(
          permission => !botMember.permissions.has(permission)
        );

        if (missingPermissions.length > 0) {
          console.warn(`Missing permissions in guild ${guild.name} (${guildId}): ${formatMissingPermissions(missingPermissions)}`);
        } else {
          console.log(`All required permissions granted in guild ${guild.name} (${guildId})`);
        }
      }

      console.log('Available guilds:', c.guilds.cache.map(g => `${g.name} (${g.id})`));
      console.log('Listening for messages in all accessible channels...');
    });

    // Update the message event handler with better error handling
    client.on(Events.MessageCreate, async message => {
      try {
        // Skip bot messages early
        if (message.author.bot) return;

        // Validate message context
        if (!message.guild || !message.member) return;

        console.log('Processing message:', {
          author: message.author.username,
          content: message.content.substring(0, 100),
          guildId: message.guildId
        });

        // Verify bot permissions with early return if insufficient
        const botMember = message.guild.members.cache.get(client?.user?.id || '');
        if (!botMember) {
          logError('Bot member not found in guild', { guildId: message.guildId });
          return;
        }

        // Check channel permissions
        if (!message.channel.isTextBased()) {
          return;
        }

        const permissions = (message.channel as TextChannel).permissionsFor(botMember);
        if (!permissions) {
          logError('Could not get channel permissions for bot', {
            channelId: message.channelId,
            guildId: message.guildId
          });
          return;
        }

        const missingPermissions = REQUIRED_PERMISSIONS.filter(
          permission => !permissions.has(permission)
        );

        if (missingPermissions.length > 0) {
          logError('Missing required permissions in channel', {
            channel: message.channel.name,
            permissions: formatMissingPermissions(missingPermissions)
          });
          return;
        }

        // Fetch message context with retry
        let contextMessages = [];
        try {
          const context = await message.channel.messages.fetch({ limit: 6 });
          contextMessages = Array.from(context.values())
            .reverse()
            .slice(0, -1)
            .map(msg => ({
              author: msg.author.username,
              content: msg.content,
            }));
        } catch (error) {
          logError('Failed to fetch message context', error);
          // Continue with empty context rather than failing
          contextMessages = [];
        }

        // Analyze message with retry mechanism
        let analysis = null;
        let retries = 3;
        while (retries > 0 && !analysis) {
          try {
            analysis = await analyzeMessage(message.content, contextMessages);
            break;
          } catch (error) {
            retries--;
            if (retries === 0) {
              logError('Failed to analyze message after all retries', error);
              return; // Skip this message if analysis completely fails
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!analysis || analysis.warningLevel === "none") {
          console.log('No violation detected, skipping punishment processing');
          return;
        }

        try {
          console.log('Starting punishment processing...');

          // Get warning level
          const warningLevel = await db.query.warningLevels.findFirst({
            where: eq(warningLevels.name, analysis.warningLevel),
          });

          if (!warningLevel) {
            console.error('Warning level not found:', analysis.warningLevel);
            return;
          }

          console.log('Found warning level:', warningLevel);

          // Get or create user
          let user = await db.query.users.findFirst({
            where: eq(users.id, message.author.id),
          });

          if (!user) {
            console.log('Creating new user:', message.author.id);
            await db.insert(users).values({
              id: message.author.id,
              username: message.author.username,
              totalPoints: 0,
            });
            user = await db.query.users.findFirst({
              where: eq(users.id, message.author.id),
            });
          }

          if (!user) {
            console.error('Failed to get/create user:', message.author.id);
            return;
          }

          // Calculate new total points
          const newTotalPoints = user.totalPoints + warningLevel.points;
          console.log('Point calculation:', {
            currentPoints: user.totalPoints,
            addedPoints: warningLevel.points,
            newTotal: newTotalPoints
          });

          // Update user points
          await db.update(users)
            .set({ totalPoints: newTotalPoints })
            .where(eq(users.id, message.author.id));

          // Process punishments
          console.log('Fetching punishment rules...');
          const activePunishmentRules = await db.query.punishmentRules.findMany({
            where: eq(punishmentRules.isActive, true),
            orderBy: (rules, { desc }) => [desc(rules.pointThreshold)],
          });

          console.log('Available punishment rules:', activePunishmentRules);

          // Find highest applicable punishment
          let appliedPunishment = null;
          for (const rule of activePunishmentRules) {
            console.log('Evaluating punishment rule:', {
              rule,
              userPoints: newTotalPoints,
              threshold: rule.pointThreshold
            });

            if (newTotalPoints >= rule.pointThreshold) {
              console.log('Threshold met for punishment:', rule);

              const success = await safeApplyPunishment(
                message.member,
                rule.type,
                rule.duration,
                "Accumulated warning points"
              );

              if (success) {
                console.log('Successfully applied punishment:', {
                  type: rule.type,
                  duration: rule.duration,
                  userId: message.author.id
                });

                await db.insert(punishments).values({
                  userId: message.author.id,
                  type: rule.type,
                  reason: "Accumulated warning points",
                  duration: rule.type === "mute" ? rule.duration : undefined,
                  expiresAt: rule.type === "mute" ? new Date(Date.now() + (rule.duration || 60) * 60 * 1000) : undefined,
                });

                appliedPunishment = rule.type;
                break;
              } else {
                console.error('Failed to apply punishment:', {
                  type: rule.type,
                  userId: message.author.id
                });
              }
            }
          }

          // Delete message if required
          let messageDeleted = false;
          if (analysis.deleteMessage) {
            messageDeleted = await safeDeleteMessage(message);
          }

          // Send warning message with fallback options
          const warningParams = {
            warningLevel: analysis.warningLevel,
            userId: message.author.id,
            points: analysis.points,
            totalPoints: newTotalPoints,
            messageDeleted: messageDeleted,
            ruleTriggered: analysis.ruleTriggered,
            punishment: appliedPunishment ?
              `${appliedPunishment === "ban" ? "🔨 banned" : "🔇 muted"}` :
              undefined
          };

          await safeSendWarning(message.channel, warningParams);

        } catch (error) {
          console.error('Error in punishment processing:', error);
          if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
          }
        }

      } catch (error) {
        console.error('Critical error in message handler:', error);
        if (error instanceof Error) {
          console.error('Stack trace:', error.stack);
        }
      }
    });

    console.log('Attempting to login to Discord...');
    await client.login(token);
    console.log('Successfully logged in to Discord');
    return { success: true };
  } catch (error) {
    console.error("Discord bot setup error:", error);
    if (error instanceof Error) {
      if (error.message.includes("disallowed intents")) {
        return {
          success: false,
          error: "The bot requires the Message Content Intent. Please go to the Discord Developer Portal, select your bot, go to the 'Bot' section, and enable the 'Message Content Intent' under 'Privileged Gateway Intents'."
        };
      }
      return {
        success: false,
        error: error.message.includes("An invalid token was provided")
          ? "The provided Discord bot token is invalid. Please check your token and try again."
          : error.message
      };
    }
    return { success: false, error: "Failed to set up Discord bot" };
  }
}