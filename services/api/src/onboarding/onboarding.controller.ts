import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { PersonaSketchService } from './persona-sketch.service';
import { IdealPartnerSketchService } from './ideal-partner-sketch.service';
import { RoleplayAgentService } from './roleplay-agent.service';
import {
  DialogueStartDto,
  DialogueTurnDto,
  Phase0IdentityDto,
  Phase1Dto,
  Phase1HintDto,
  PersonaSketchAdjustDto,
  BatchAdjustDto,
  IdealPartnerAdjustDto,
  RoleplayStartDto,
  RoleplayTurnDto,
  RoleplayEndDto,
  SurveyDto,
} from './onboarding.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
// 【缺陷9 修复】onboarding 限流：每分钟 20 次
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly personaSketch: PersonaSketchService,
    private readonly idealPartnerSketch: IdealPartnerSketchService,
    private readonly roleplayAgent: RoleplayAgentService,
  ) {}

  @Post('phase0')
  phase0(@CurrentUser() userId: string, @Body() dto: Phase0IdentityDto) {
    return this.onboarding.submitPhase0(userId, dto);
  }

  @Post('phase1')
  phase1(@CurrentUser() userId: string, @Body() dto: Phase1Dto) {
    return this.onboarding.submitPhase1(userId, dto);
  }

  @Post('phase1/hint')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  phase1Hint(@CurrentUser() userId: string, @Body() dto: Phase1HintDto) {
    return this.personaSketch.generateHint(userId, dto.cardId);
  }

  @Post('survey')
  survey(@CurrentUser() userId: string, @Body() dto: SurveyDto) {
    return this.onboarding.submitSurvey(userId, dto as Record<string, unknown>);
  }

  @Post('dialogue/start')
  startDialogue(@CurrentUser() userId: string, @Body() dto: DialogueStartDto) {
    return this.onboarding.startDialogue(userId, dto.sessionId);
  }

  @Post('dialogue/turn')
  turn(@CurrentUser() userId: string, @Body() dto: DialogueTurnDto) {
    return this.onboarding.dialogueTurn(userId, dto.message, dto.sessionId);
  }

  @Post('finalize')
  finalize(@CurrentUser() userId: string) {
    return this.onboarding.finalize(userId);
  }

  // ---------- Phase 1.5: 人格画像合成 ----------

  @Post('persona-sketch/generate')
  generateSketch(@CurrentUser() userId: string) {
    return this.personaSketch.generate(userId);
  }

  @Post('persona-sketch/adjust')
  adjustSketch(@CurrentUser() userId: string, @Body() dto: PersonaSketchAdjustDto) {
    return this.personaSketch.adjust(userId, dto.section, dto.userCorrection);
  }

  @Post('persona-sketch/batch-adjust')
  batchAdjustSketch(@CurrentUser() userId: string, @Body() dto: BatchAdjustDto) {
    return this.personaSketch.batchAdjust(userId, dto.corrections);
  }

  // ---------- Phase 1.6: 理想伴侣画像合成 ----------

  @Post('ideal-partner-sketch/generate')
  generateIdealSketch(@CurrentUser() userId: string) {
    return this.idealPartnerSketch.generate(userId);
  }

  @Post('ideal-partner-sketch/adjust')
  adjustIdealSketch(@CurrentUser() userId: string, @Body() dto: IdealPartnerAdjustDto) {
    return this.idealPartnerSketch.adjust(userId, dto.userFeedback);
  }

  // ---------- Phase 1.7: 个性化角色档案 ----------

  @Post('roleplay/generate-profiles')
  generateAgentProfiles(@CurrentUser() userId: string) {
    return this.roleplayAgent.generateAgentProfiles(userId);
  }

  // ---------- Phase 2: 对话式角色扮演 ----------

  @Post('roleplay/start')
  roleplayStart(@CurrentUser() userId: string, @Body() dto: RoleplayStartDto) {
    return this.roleplayAgent.startChat(userId, dto.roleName);
  }

  @Post('roleplay/turn')
  roleplayTurn(@CurrentUser() userId: string, @Body() dto: RoleplayTurnDto) {
    return this.roleplayAgent.chatTurn(userId, dto.chatId, dto.message);
  }

  @Post('roleplay/end')
  roleplayEnd(@CurrentUser() userId: string, @Body() dto: RoleplayEndDto) {
    return this.roleplayAgent.endChat(userId, dto.chatId);
  }

  @Post('roleplay/extract-style')
  roleplayExtractStyle(@CurrentUser() userId: string) {
    return this.roleplayAgent.extractStyleProfile(userId);
  }
}
