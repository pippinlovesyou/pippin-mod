import OpenAI from "openai";
import { db } from "@db";
import { openaiSettings, rules, warningLevels, aiPromptTemplates, aiPromptHistory } from "@db/schema";
import { eq } from "drizzle-orm";

// Note: gpt-4o-mini is the latest model as of May 13, 2024
async function getOpenAIClient() {
  const settings = await db.query.openaiSettings.findFirst({
    orderBy: (openaiSettings, { desc }) => [desc(openaiSettings.createdAt)],
  });

  if (!settings?.apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  return new OpenAI({ apiKey: settings.apiKey });
}

export async function testOpenAIConnection(): Promise<void> {
  const openai = await getOpenAIClient();

  // Make a simple API call to test the connection
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "test" }],
  });
}

async function getActivePromptTemplate(): Promise<string> {
  // Get the active template
  const template = await db.query.aiPromptTemplates.findFirst({
    where: eq(aiPromptTemplates.isActive, true),
    orderBy: (aiPromptTemplates, { desc }) => [desc(aiPromptTemplates.updatedAt)],
  });

  if (!template) {
    throw new Error("No active prompt template found");
  }

  // Get all rules with their warning levels
  const rulesWithLevels = await db.query.rules.findMany({
    with: {
      level: true,
    },
    orderBy: (rules, { asc }) => [asc(rules.id)],
  });

  // Format rules list
  const rulesList = rulesWithLevels.map(rule => 
    `Rule ${rule.id}: ${rule.name} - ${rule.description} (Warning Level: ${rule.level.name})`
  ).join("\n");

  // Replace placeholder with actual rules
  return template.systemPrompt.replace("{{RULES_LIST}}", rulesList);
}

interface MessageContext {
  author: string;
  content: string;
}

export interface AnalysisResult {
  violation: {
    detected: boolean;
    ruleId: number | null;
    levelName: string | null;
    confidence: number;
  };
  analysis: {
    explanation: string;
    context: {
      relevant: boolean;
      explanation: string;
    };
  };
  recommendation: {
    action: "none" | "warn" | "delete" | "mute" | "ban";
    reason: string;
  };
}

export async function analyzeContent(
  content: string,
  context: MessageContext[]
): Promise<AnalysisResult> {
  const openai = await getOpenAIClient();
  const systemPrompt = await getActivePromptTemplate();

  const contextString = context
    .map(msg => `${msg.author}: ${msg.content}`)
    .join("\n");

  const userPrompt = `Previous messages:\n${contextString}\n\nMessage to analyze: ${content}`;

  console.log('Sending OpenAI request with prompt:', {
    systemPrompt,
    userPrompt,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const responseContent = response.choices[0].message.content;
    console.log('Raw OpenAI response:', responseContent);

    // Parse and validate response
    const result = JSON.parse(responseContent || '{}') as AnalysisResult;

    console.log('Parsed analysis result:', result);

    return {
      violation: {
        detected: result.violation?.detected ?? false,
        ruleId: result.violation?.ruleId ?? null,
        levelName: result.violation?.levelName ?? null,
        confidence: result.violation?.confidence ?? 0,
      },
      analysis: {
        explanation: result.analysis?.explanation ?? "No explanation provided",
        context: {
          relevant: result.analysis?.context?.relevant ?? false,
          explanation: result.analysis?.context?.explanation ?? "",
        },
      },
      recommendation: {
        action: result.recommendation?.action ?? "none",
        reason: result.recommendation?.reason ?? "No reason provided",
      },
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      violation: {
        detected: false,
        ruleId: null,
        levelName: null,
        confidence: 0,
      },
      analysis: {
        explanation: "Error analyzing content",
        context: {
          relevant: false,
          explanation: "",
        },
      },
      recommendation: {
        action: "none",
        reason: "Analysis failed",
      },
    };
  }
}