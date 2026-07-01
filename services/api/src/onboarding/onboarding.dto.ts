// 【缺陷9修复】引入 ValidateNested 与 Type，对嵌套数组元素做深度校验
// 四层人格采集模型：所有新字段 optional，向后兼容旧问卷。
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

// ---------- M1: 身份基座 ----------

export class SocialSpectrumDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  strangerComfort?: number;

  @IsOptional()
  @IsString()
  friendRole?: string;

  @IsOptional()
  @IsString()
  groupRole?: string;
}

// ---------- M2: 语言指纹 ----------

export class StyleReplyDto {
  @IsString()
  scenarioId!: string;

  @IsString()
  choiceId!: string;

  @IsString()
  text!: string;

  /** 关系情境追问的回答（可选） */
  @IsOptional()
  @IsString()
  relationContext?: string;
}

/** 兼容旧 string[] 与新 { tag, evidence }[] */
export class ToneTagWithEvidenceDto {
  @IsString()
  tag!: string;

  @IsOptional()
  @IsString()
  evidence?: string;
}

export class ChatHabitsDto {
  @IsOptional()
  @IsBoolean()
  usesPunctuation?: boolean;

  @IsOptional()
  @IsBoolean()
  likesEmoji?: boolean;

  @IsOptional()
  @IsBoolean()
  prefersShortMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  sendsVoiceMessages?: boolean;
}

export class EmotionalPatternsDto {
  @IsOptional()
  @IsString()
  badMoodNeed?: string;

  @IsOptional()
  @IsString()
  happyExpression?: string;
}

// ---------- M3: 信念系统 ----------

export class ValuesChoiceDto {
  @IsString()
  questionId!: string;

  @IsString()
  choiceId!: string;

  @IsString()
  label!: string;
}

export class OpinionProbeDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsString()
  choiceId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

// ---------- v2.2: Phase 0 / 1 / 1.5 / 2 DTO ----------

export class FamilyMemberDto {
  @IsEnum(['father', 'mother', 'sibling', 'partner', 'other'], {
    message: '家庭成员关系请选择：父亲、母亲、兄弟姐妹、伴侣或其他',
  })
  relation!: 'father' | 'mother' | 'sibling' | 'partner' | 'other';

  @IsString()
  @MaxLength(20, { message: '家庭成员描述最多 20 字' })
  brief!: string;
}

export class ScenarioCardDto {
  @IsString()
  cardId!: string;

  @IsEnum(['A', 'B', 'C', 'D', 'custom'], {
    message: '情境选择请选 A/B/C/D 或自定义',
  })
  choice!: 'A' | 'B' | 'C' | 'D' | 'custom';

  @IsOptional()
  @IsString()
  freeText?: string;

  @IsOptional()
  @IsInt()
  responseTimeMs?: number;
}

export class DimensionScoreDto {
  @IsNumber()
  value!: number;

  @IsEnum(['high', 'medium', 'low'])
  confidence!: 'high' | 'medium' | 'low';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contradictions?: string[];
}

export class RoleplayChatMessageDto {
  @IsEnum(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;

  @IsNumber()
  timestamp!: number;
}

export class RoleplayChatDto {
  @IsEnum(['stranger', 'bestfriend', 'crush', 'oldfriend'])
  roleName!: 'stranger' | 'bestfriend' | 'crush' | 'oldfriend';

  @IsString()
  agentName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleplayChatMessageDto)
  messages!: RoleplayChatMessageDto[];

  @IsNumber()
  startedAt!: number;

  @IsNumber()
  endedAt!: number;

  @IsOptional()
  @IsEnum(['good', 'low_effort', 'incomplete'])
  qualityFlag?: 'good' | 'low_effort' | 'incomplete';
}

export class StyleProfileDto {
  @IsObject()
  baselineParams!: {
    avgReplyLength: number;
    sentenceLengthDist: Record<string, number>;
    emojiDensity: number;
    punctuationHabits: Record<string, number>;
    topCatchphrases: string[];
    commonParticles: string[];
  };

  @IsObject()
  relationSwitchRules!: Record<string, string>;

  @IsObject()
  emotionalReactionPatterns!: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  boundaries!: string[];
}

export class SectionAdjustmentDto {
  @IsString()
  section!: string;

  @IsString()
  originalText!: string;

  @IsString()
  userCorrection!: string;
}

export class PersonaSketchSectionsDto {
  @IsString()
  identityNarrative!: string;

  @IsString()
  personalityTexture!: string;

  @IsString()
  coreBeliefs!: string;

  @IsString()
  valuesInAction!: string;

  @IsString()
  caringStyle!: string;

  @IsString()
  socialBoundaries!: string;

  @IsString()
  contradictions!: string;

  @IsArray()
  @IsString({ each: true })
  voiceAnchors!: string[];
}

export class PersonaSketchDto {
  @IsString()
  narrative!: string;

  @ValidateNested()
  @Type(() => PersonaSketchSectionsDto)
  sections!: PersonaSketchSectionsDto;

  @IsNumber()
  generationTimestamp!: number;
}

export class UserFeedbackDto {
  @IsBoolean()
  accepted!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionAdjustmentDto)
  sectionAdjustments?: SectionAdjustmentDto[];
}

/** Phase 1 hint: AI 生成情境卡片参考答案 */
export class Phase1HintDto {
  @IsString()
  cardId!: string;
}

/** Batch adjust: 批量句子级修正 */
export class SentenceCorrectionDto {
  @IsString()
  sectionKey!: string;

  @IsString()
  originalSentence!: string;

  @IsString()
  correctedSentence!: string;
}

export class BatchAdjustDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SentenceCorrectionDto)
  corrections!: SentenceCorrectionDto[];
}

export class Phase0IdentityDto {
  @IsString()
  displayName!: string;

  @IsString()
  preferredAddress!: string;

  @IsEnum(['male', 'female', 'nonbinary', 'unspecified'], {
    message: '性别认同请选择：男、女、非二元或不想说',
  })
  genderIdentity!: 'male' | 'female' | 'nonbinary' | 'unspecified';

  @IsEnum(['18-22', '23-27', '28-32', '33-38', '39-45', '46+'], {
    message: '年龄段请选择有效范围',
  })
  ageBand!: '18-22' | '23-27' | '28-32' | '33-38' | '39-45' | '46+';

  @IsString()
  hometownCity!: string;

  @IsString()
  currentCity!: string;

  @IsEnum(['highschool', 'college', 'bachelor', 'master', 'phd'], {
    message: '教育程度请选择：高中/中专、大专、本科、硕士或博士',
  })
  education!: 'highschool' | 'college' | 'bachelor' | 'master' | 'phd';

  @IsString()
  occupation!: string;

  @IsString()
  industry!: string;

  @IsOptional()
  @IsString()
  entrepreneurshipField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  workDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: '每条关键经历最多 80 字' })
  keyLifeExperiences?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  selfIntroOneLiner?: string;

  @IsOptional()
  @IsString()
  goalOnEcho?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  familyMembers?: FamilyMemberDto[];

  @IsOptional()
  @IsObject()
  matchPreference?: {
    preferredGender?: string;
    preferredAgeBand?: string[];
    preferredCity?: string;
    preferredOccupation?: string[];
  };
}

// ---------- 主问卷 DTO ----------

export class SurveyDto {
  // --- M1: 身份基座 ---
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsArray()
  interests?: string[];

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  selfDescription?: string;

  @IsOptional()
  @IsString()
  dailyRoutine?: string;

  /** key=兴趣名，value=为什么喜欢 */
  @IsOptional()
  @IsObject()
  interestContexts?: Record<string, string>;

  @IsOptional()
  @IsString()
  keyExperience?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialSpectrumDto)
  socialSpectrum?: SocialSpectrumDto;

  // --- M2: 语言指纹（含关系情境层） ---
  // 【缺陷9修复】嵌套数组元素用 @ValidateNested + @Type 触发子 DTO 校验
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StyleReplyDto)
  styleReplies?: StyleReplyDto[];

  /** 兼容：可能是 string[] 或 ToneTagWithEvidenceDto[]，先用 IsArray 放行，service 层归一化 */
  @IsOptional()
  @IsArray()
  toneTags?: unknown[];

  @IsOptional()
  @IsString()
  freeWritingSample?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catchphrases?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatHabitsDto)
  chatHabits?: ChatHabitsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmotionalPatternsDto)
  emotionalPatterns?: EmotionalPatternsDto;

  @IsOptional()
  @IsString()
  caringStyle?: string;

  // --- M3: 信念系统 ---
  // 【缺陷9修复】嵌套数组元素用 @ValidateNested + @Type 触发子 DTO 校验
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValuesChoiceDto)
  valuesChoices?: ValuesChoiceDto[];

  /** key=questionId，value=理由 */
  @IsOptional()
  @IsObject()
  valuesWhy?: Record<string, string>;

  @IsOptional()
  @IsString()
  trustView?: string;

  @IsOptional()
  @IsString()
  happinessView?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpinionProbeDto)
  opinionProbes?: OpinionProbeDto[];

  @IsOptional()
  @IsString()
  changedMind?: string;

  @IsOptional()
  @IsString()
  feelingHeardSignal?: string;

  @IsOptional()
  @IsString()
  shutDownTrigger?: string;

  // --- v2.2 Phase 0: 身份基座（扩展） ---
  @IsOptional()
  @ValidateNested()
  @Type(() => Phase0IdentityDto)
  identity?: Phase0IdentityDto;

  // --- v2.2 Phase 1: 情境卡片 ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioCardDto)
  scenarioCards?: ScenarioCardDto[];

  @IsOptional()
  @IsObject()
  dimensionScores?: {
    bigFive?: Record<string, DimensionScoreDto>;
    timePerspective?: string;
    moralFoundations?: Record<string, number>;
    attachmentStyle?: string;
  };

  // --- v2.2 Phase 1.5: 人格画像合成 ---
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonaSketchDto)
  personaSketch?: PersonaSketchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserFeedbackDto)
  userFeedback?: UserFeedbackDto;

  // --- v2.2 Phase 2: 对话式角色扮演 ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleplayChatDto)
  roleplayChats?: RoleplayChatDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StyleProfileDto)
  styleProfile?: StyleProfileDto;

  // --- 兼容 ---
  @IsOptional()
  @IsString()
  sampleMessage?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

// ---------- Phase 1 专用 DTO ----------

export class Phase1Dto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioCardDto)
  cards!: ScenarioCardDto[];

  @IsOptional()
  @IsNumber()
  completionTimestamp?: number;
}

export class DialogueStartDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class DialogueTurnDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

// ---------- Phase 1.5: 人格画像调整 ----------

export class PersonaSketchAdjustDto {
  @IsString()
  section!: string;

  @IsString()
  @MaxLength(30)
  userCorrection!: string;
}

// ---------- Phase 2: 对话式角色扮演 ----------

export class RoleplayStartDto {
  @IsEnum(['stranger', 'bestfriend', 'crush', 'oldfriend'], {
    message: '角色扮演请选择：陌生人、好朋友、心动对象或老朋友',
  })
  roleName!: 'stranger' | 'bestfriend' | 'crush' | 'oldfriend';
}

export class RoleplayTurnDto {
  @IsString()
  @MinLength(1)
  chatId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}

export class RoleplayEndDto {
  @IsString()
  @MinLength(1)
  chatId!: string;
}
