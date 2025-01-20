import { analyzeContent, type AnalysisResult } from "./openai";

interface MessageContext {
  author: string;
  content: string;
}

interface WarningResult {
  warningLevel: "none" | "yellow" | "orange" | "red";
  ruleTriggered: string;
  deleteMessage: boolean;
  points: number;
}

const WARNING_CONFIGS = {
  yellow: {
    points: 1,
    deleteMessage: false,
  },
  orange: {
    points: 3,
    deleteMessage: true,
  },
  red: {
    points: 5,
    deleteMessage: true,
  },
};

type WarningLevel = keyof typeof WARNING_CONFIGS;

function mapAnalysisToWarning(analysis: AnalysisResult): WarningResult {
  // If no violation detected, return none
  if (!analysis.violation.detected) {
    return {
      warningLevel: "none",
      ruleTriggered: "",
      deleteMessage: false,
      points: 0,
    };
  }

  // Map the warning level from the OpenAI response
  const warningLevel = analysis.violation.levelName?.toLowerCase() as WarningLevel | "none";

  // If invalid warning level, default to none
  if (!warningLevel || !(warningLevel in WARNING_CONFIGS)) {
    console.warn('Invalid warning level received:', warningLevel);
    return {
      warningLevel: "none",
      ruleTriggered: "",
      deleteMessage: false,
      points: 0,
    };
  }

  const config = WARNING_CONFIGS[warningLevel];

  return {
    warningLevel,
    ruleTriggered: analysis.analysis.explanation,
    points: config.points,
    deleteMessage: config.deleteMessage,
  };
}

export async function analyzeMessage(
  content: string,
  context: MessageContext[]
): Promise<WarningResult> {
  console.log('Analyzing message:', { content, contextLength: context.length });

  const analysis = await analyzeContent(content, context);
  console.log('Received analysis:', analysis);

  const warning = mapAnalysisToWarning(analysis);
  console.log('Mapped to warning:', warning);

  return warning;
}