import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { DialogueStartDto, DialogueTurnDto, SurveyDto } from './onboarding.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

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
}
