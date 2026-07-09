import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { CloneStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CloneBoundaries, CloneBoundariesDto } from './clone-boundaries';
import { CloneActivityService } from './clone-activity.service';
import {
  ClonesService,
  MyPostDto,
  PersonaSketchSectionItem,
  ScenarioCardWithText,
} from './clones.service';
import type { IdealPartnerSketch } from '../onboarding/survey-schema';

class UpdateCloneDto {
  @IsOptional()
  @IsEnum(CloneStatus)
  status?: CloneStatus;

  @IsOptional()
  @IsString()
  personaText?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CloneBoundariesDto)
  boundaries?: CloneBoundariesDto;
}

/** personaSketch section 单项（编辑用，只接收 key + narrative） */
class PersonaSketchSectionDto {
  @IsString()
  key!: string;

  @IsString()
  @MinLength(1)
  narrative!: string;
}

/** PUT /clones/me/persona-sketch 请求体 */
class UpdatePersonaSketchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaSketchSectionDto)
  sections!: PersonaSketchSectionDto[];
}

/** 理想伴侣探测卡单项（补答用） */
class IdealPartnerCardDto {
  @IsString()
  cardId!: string;

  @IsString()
  choice!: string;

  @IsOptional()
  @IsString()
  freeText?: string;
}

/** POST /clones/me/ideal-partner/cards 请求体 */
class SubmitIdealPartnerCardsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdealPartnerCardDto)
  cards!: IdealPartnerCardDto[];
}

/**
 * GET /clones/me 返回结构。
 * 修复点：新增 socialStats 分项统计 { postCount, commentCount, matchCount }，
 * 替代旧的 interactionCount 混算。interactionCount 保留以向后兼容旧前端。
 *
 * - postCount: 当前 clone 发表的 Post 数量
 * - commentCount: 当前 clone 发表的 Comment 数量
 * - matchCount: AgentSession 中"对方 clone 不同于自己"的唯一匹配数（去重）
 *
 * v1.2 扩展：新增 relationshipIntent / scenarioCards / personaSketch /
 * idealPartnerSketch / gender / lastPostAt，让前端从单一 API 拿到分身页全量数据。
 * 所有新字段 optional（null when absent），向后兼容旧前端。
 */
export interface GetMeResponseDto {
  id: string;
  status: CloneStatus;
  consentAt: Date | null;
  persona: string | null;
  boundaries: CloneBoundaries | null;
  /** 旧字段：post + comment + like + session 混算（向后兼容保留） */
  interactionCount: number;
  /** 新字段：分项统计，前端可分别展示 post / comment / match 三类 */
  socialStats: {
    postCount: number;
    commentCount: number;
    matchCount: number;
  };
  /** 用户在 Echo 上的目标（关系意图），来自 Profile.matchPrefsJson */
  relationshipIntent: string | null;
  /** 情境卡片回答（前 8 张，已补 scenarioText 供前端直接渲染），来自 Profile.bioJson.scenarioCards */
  scenarioCards: ScenarioCardWithText[] | null;
  /** 人格画像（narrative + 7 段 sections），来自 Profile.bioJson.personaSketch（向后兼容保留） */
  personaSketch: {
    narrative: string;
    sections: {
      identityNarrative: string;
      personalityTexture: string;
      coreBeliefs: string;
      valuesInAction: string;
      caringStyle: string;
      socialBoundaries: string;
      contradictions: string;
      voiceAnchors: string[];
    };
  } | null;
  /** personaSketch sections 数组化（[{key,title,narrative}]），前端渲染用 */
  personaSketchSections: PersonaSketchSectionItem[] | null;
  /** 理想伴侣画像（narrative + dimensions），来自 Profile.bioJson.idealPartnerSketch（向后兼容保留） */
  idealPartnerSketch: IdealPartnerSketch | null;
  /** 理想型自然语言描述（idealPartnerSketch.narrative 提取），前端展示用 */
  idealPartnerNarrative: string | null;
  /** 3 道理想伴侣探测卡是否已答（前端 CTA 判断：已答→直接生成，未答→先补答） */
  idealPartnerCardsAnswered: boolean;
  /** 性别（用于前端默认头像选择），来自 Profile.gender */
  gender: string | null;
  /** 最后发帖时间（ISO 8601），来自 Redis clone:meta:{cloneId}.lastPostAt */
  lastPostAt: string | null;
}

@Controller('clones')
@UseGuards(JwtAuthGuard)
export class ClonesController {
  constructor(
    private readonly clones: ClonesService,
    private readonly cloneActivity: CloneActivityService,
  ) {}

  @Get('me')
  me(@CurrentUser() userId: string): Promise<GetMeResponseDto> {
    return this.clones.getMe(userId);
  }

  @Get('me/posts')
  myPosts(@CurrentUser() userId: string): Promise<MyPostDto[]> {
    return this.clones.getMyPosts(userId);
  }

  /**
   * PUT /clones/me/persona-sketch — 编辑人格画像 sections，持久化到 bioJson.personaSketch.sections。
   * 仅允许更新 7 个已知 key（白名单），personaSketch 不存在时返回 400。
   */
  @Put('me/persona-sketch')
  updatePersonaSketch(
    @CurrentUser() userId: string,
    @Body() dto: UpdatePersonaSketchDto,
  ): Promise<GetMeResponseDto> {
    return this.clones.updatePersonaSketch(userId, dto.sections);
  }

  @Put('me')
  update(@CurrentUser() userId: string, @Body() dto: UpdateCloneDto) {
    return this.clones.updateMe(userId, dto);
  }

  @Post('me/pause')
  pause(@CurrentUser() userId: string) {
    return this.clones.pause(userId);
  }

  @Post('me/resume')
  resume(@CurrentUser() userId: string) {
    return this.clones.resume(userId);
  }

  /**
   * POST /clones/me/ideal-partner/cards — 补答 3 道理想伴侣探测卡。
   * 已 finalize 用户绕开 OnboardingSession.completed 限制，合并答案到 Profile.bioJson + 重算维度。
   * 不生成 idealPartnerSketch（由 generate 端点单独触发）。
   */
  @Post('me/ideal-partner/cards')
  submitIdealPartnerCards(
    @CurrentUser() userId: string,
    @Body() dto: SubmitIdealPartnerCardsDto,
  ) {
    return this.clones.submitIdealPartnerCards(userId, dto.cards);
  }

  /**
   * POST /clones/me/ideal-partner/generate — 生成理想型描述 + 重算 ideal_embedding。
   * 从 Profile.bioJson 读数据，调 IdealPartnerSketchService.generateFromSurvey 合成叙事，
   * 写回 bioJson.idealPartnerSketch，并 upsert profile_embeddings.ideal_embedding。
   * 前置：3 道探测卡已答（否则返回 400 提示先补答）。
   */
  @Post('me/ideal-partner/generate')
  generateIdealPartner(@CurrentUser() userId: string) {
    return this.clones.generateIdealPartner(userId);
  }

  @Get('me/activity')
  listActivity(@CurrentUser() userId: string, @Query('type') type?: string) {
    return this.cloneActivity.list(userId, type);
  }
}
